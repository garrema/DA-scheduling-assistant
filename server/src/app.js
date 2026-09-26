import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DateTime } from 'luxon';
import { ZodError } from 'zod';
import { Workspace, Session } from './models.js';
import { memberSchema, configSchema, availabilitySchema, shiftSchema, assignmentSchema, weekSchema, revisionSchema } from './contracts.js';
import { fail, weekBounds, checkShift, problemFor, publicState, callEngine, missingCoverage, coverageBlocks } from './domain.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8*60*60*1000 });
export function createApp(engine = callEngine) {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null } } }));
  app.use(express.json({ limit: '250kb' }));
  app.use(cookieParser());
  // Same-origin browser requests only; JSON content plus Origin checking protects writes.
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== (process.env.CLIENT_ORIGIN || 'http://localhost:5173')) return res.status(403).json({ error: 'Untrusted request origin' });
    next();
  });
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  const loginLimit = rateLimit({ windowMs: 15*60*1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  app.post('/api/login', loginLimit, async (req, res) => {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || password.length > 72) fail('Invalid credentials', 401);
    const workspace = await Workspace.findOne({ 'members.email': email.trim().toLowerCase() }).lean();
    const member = workspace?.members.find(m => m.email === email.trim().toLowerCase());
    if (!member || !await bcrypt.compare(password, member.passwordHash)) fail('Invalid credentials', 401);
    const token = randomBytes(32).toString('hex');
    await Session.create({ tokenHash: hash(token), workspaceId: workspace._id, memberId: member.id, expiresAt: new Date(Date.now()+8*60*60*1000) });
    res.cookie('session', token, cookieOptions()).json({ ok: true });
  });
  app.use('/api', async (req, res, next) => {
    const token = req.cookies.session;
    const session = token && await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) fail('Please sign in', 401);
    req.workspace = await Workspace.findById(session.workspaceId).lean();
    req.member = req.workspace?.members.find(m => m.id === session.memberId);
    if (!req.member) fail('Account no longer exists', 401);
    next();
  });
  app.post('/api/logout', async (req, res) => {
    await Session.deleteOne({ tokenHash: hash(req.cookies.session) });
    res.clearCookie('session', cookieOptions()).json({ ok: true });
  });
  app.get('/api/state', (req, res) => res.json(publicState(req.workspace, req.member)));
  function manager(req, res, next) { if (req.member.role !== 'manager') fail('Manager access required', 403); next(); }
  function revision(req) {
    const expected = revisionSchema.parse(req.body.revision);
    if (expected !== req.workspace.revision) fail('Someone changed this neighborhood. Refresh and try again.', 409);
    return expected;
  }
  async function save(req, res, changes) {
    const expected = revision(req);
    const result = await Workspace.findOneAndUpdate({ _id: req.workspace._id, revision: expected }, { $set: changes, $inc: { revision: 1 } }, { new: true }).lean();
    if (!result) fail('Schedule changed while this operation ran. Refresh and retry.', 409);
    res.json(publicState(result, req.member));
  }
  function draft(req) {
    const week = weekSchema.parse(req.params.week);
    weekBounds(week, req.workspace.config.timezone);
    const plan = req.workspace.plans[week] || { status: 'draft', shifts: [], gaps: [] };
    if (plan.status === 'published') fail('Reopen this schedule before editing');
    return { week, plan: structuredClone(plan) };
  }
  async function check(workspace, week, shifts) {
    for (const s of shifts) checkShift(s, week, workspace.config);
    const { errors } = await engine('/validate', problemFor(workspace, week, shifts));
    if (errors.length) fail(errors.join('; '));
  }
  app.post('/api/password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || !await bcrypt.compare(currentPassword, req.member.passwordHash)) fail('Current password is incorrect', 400);
    if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 72) fail('Use 12–72 characters');
    const members = structuredClone(req.workspace.members);
    members.find(m => m.id === req.member.id).passwordHash = await bcrypt.hash(newPassword, 12);
    await save(req, res, { members });
  });
  app.post('/api/members', manager, async (req, res) => {
    revision(req);
    if (req.workspace.members.length >= 151) fail('Pilot limit: 150 DAs per neighborhood');
    const body = memberSchema.parse(req.body);
    if (await Workspace.exists({ 'members.email': body.email })) fail('This email is already registered');
    const member = { id: randomUUID(), name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 12), role: 'da', availability: [], exceptions: [], nightPreference: false };
    await save(req, res, { members: [...req.workspace.members, member] });
  });
  app.put('/api/availability', async (req, res) => {
    const body = availabilitySchema.parse(req.body);
    const members = req.workspace.members.map(m => m.id === req.member.id ? { ...m, ...body } : m);
    // Published assignments remain commitments; do not silently invalidate them.
    const proposed = { ...req.workspace, members };
    for (const [week, plan] of Object.entries(proposed.plans)) {
      if (plan.status === 'published' && weekBounds(week, proposed.config.timezone).end.toMillis() > Date.now()) await check(proposed, week, plan.shifts);
    }
    await save(req, res, { members });
  });
  app.put('/api/config', manager, async (req, res) => {
    const config = configSchema.parse(req.body.config);
    if (!DateTime.now().setZone(config.timezone).isValid) fail('Unknown IANA timezone');
    if (Object.keys(req.workspace.plans).length && config.timezone !== req.workspace.config.timezone) fail('Timezone cannot change after a plan exists');
    const proposed = { ...req.workspace, config };
    for (const [week, plan] of Object.entries(proposed.plans)) if (plan.status === 'published') await check(proposed, week, plan.shifts);
    await save(req, res, { config });
  });
  app.post('/api/plans/:week/coverage', manager, async (req, res) => {
    const { week, plan } = draft(req);
    if (plan.shifts.length) fail('Automatic coverage setup is only available for an empty week');
    const required = req.body.required;
    if (!Number.isInteger(required) || required < 1 || required > 10) fail('Staffing must be 1–10');
    plan.shifts = coverageBlocks(req.workspace, week).map(s => ({ id: randomUUID(), ...s, required, assignees: [], locked: false }));
    await save(req, res, { [`plans.${week}`]: plan });
  });
  app.post('/api/plans/:week/shifts', manager, async (req, res) => {
    const { week, plan } = draft(req);
    const body = shiftSchema.parse(req.body);
    if (plan.shifts.length >= 100) fail('Pilot limit: 100 shift records per week');
    checkShift(body, week, req.workspace.config);
    if (plan.shifts.some(s => Date.parse(s.start) < Date.parse(body.end) && Date.parse(body.start) < Date.parse(s.end))) fail('Coverage blocks cannot overlap. Set required staffing on the existing block.');
    plan.shifts.push({ id: randomUUID(), ...body, assignees: [], locked: false });
    plan.shifts.sort((a, b) => Date.parse(a.start)-Date.parse(b.start));
    plan.gaps = [];
    await save(req, res, { [`plans.${week}`]: plan });
  });
  app.delete('/api/plans/:week/shifts/:id', manager, async (req, res) => {
    const { week, plan } = draft(req);
    if (!plan.shifts.some(s => s.id === req.params.id)) fail('Shift not found', 404);
    plan.shifts = plan.shifts.filter(s => s.id !== req.params.id);
    plan.gaps = [];
    await save(req, res, { [`plans.${week}`]: plan });
  });
  app.put('/api/plans/:week/shifts/:id', manager, async (req, res) => {
    const { week, plan } = draft(req);
    const shift = plan.shifts.find(s => s.id === req.params.id);
    if (!shift) fail('Shift not found', 404);
    Object.assign(shift, assignmentSchema.parse(req.body));
    await check(req.workspace, week, plan.shifts);
    plan.gaps = [];
    await save(req, res, { [`plans.${week}`]: plan });
  });
  app.post('/api/plans/:week/generate', manager, async (req, res) => {
    revision(req);
    const { week, plan } = draft(req);
    if (!plan.shifts.length) fail('Add coverage blocks first');
    for (const shift of plan.shifts) checkShift(shift, week, req.workspace.config);
    const result = await engine('/solve', problemFor(req.workspace, week, plan.shifts));
    if (!result.assignments) fail(result.message || 'Scheduler could not find a solution');
    for (const shift of plan.shifts) shift.assignees = result.assignments[shift.id];
    await check(req.workspace, week, plan.shifts);
    Object.assign(plan, { gaps: result.gaps, solverStatus: result.status, coverageOptimal: result.coverageOptimal });
    await save(req, res, { [`plans.${week}`]: plan });
  });
  app.post('/api/plans/:week/publish', manager, async (req, res) => {
    const { week, plan } = draft(req);
    if (!plan.shifts.length) fail('Add shifts first');
    await check(req.workspace, week, plan.shifts);
    if (plan.shifts.some(s => s.assignees.length !== s.required)) fail('Fill all defined coverage blocks before publishing');
    const gaps = missingCoverage(req.workspace, week, plan.shifts);
    if (gaps.length) fail('Operating hours without coverage blocks: '+gaps.join(', '));
    plan.status = 'published';
    plan.publishedAt = new Date().toISOString();
    await save(req, res, { [`plans.${week}`]: plan });
  });
  app.post('/api/plans/:week/reopen', manager, async (req, res) => {
    const week = weekSchema.parse(req.params.week);
    const plan = req.workspace.plans[week];
    if (!plan || plan.status !== 'published') fail('Published schedule not found');
    await save(req, res, { [`plans.${week}`]: { ...plan, status: 'draft' } });
  });
  const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  app.use(express.static(dist));
  app.get('/{*path}', (req, res) => req.path.startsWith('/api/') ? res.status(404).json({ error: 'Not found' }) : res.sendFile(path.join(dist, 'index.html')));
  app.use((err, req, res, next) => {
    if (err instanceof ZodError) return res.status(400).json({ error: err.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; ') });
    if (err.code === 11000) return res.status(409).json({ error: 'This email already exists' });
    const status = err.status || (['TimeoutError', 'AbortError'].includes(err.name) ? 504 : 500);
    if (status >= 500) console.error(err.message);
    res.status(status).json({ error: status === 500 ? 'Server error. Check that MongoDB and the scheduler are running.' : err.message });
  });
  return app;
}
