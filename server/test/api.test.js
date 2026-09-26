import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { useMemoryStore } from './memory-store.js';
import { Workspace } from '../src/models.js';
let mongo, app, manager, da;
const origin = 'http://localhost:5173';
const email = 'manager@test.example', password = 'a-strong-test-password';
const config = { timezone: 'America/New_York', maxHours: 20, targetHours: 10, maxContinuousHours: 6, minRestHours: 8, openHours: [{ day: 1, start: 480, end: 720 }] };
const week = '2026-09-28';
const engine = async (path, body) => {
  // Real engine when integration service is configured; otherwise a narrow API test stub.
  if (process.env.SCHEDULER_KEY) {
    const r = await fetch((process.env.SCHEDULER_URL || 'http://127.0.0.1:8000')+path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Scheduler-Key': process.env.SCHEDULER_KEY }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
  return path === '/validate' ? { errors: [] } : { status: 'OPTIMAL', coverageOptimal: true, gaps: [], assignments: Object.fromEntries(body.shifts.map(s => [s.id, [body.employees[0].id]])) };
};
before(async () => {
  if (process.env.IN_MEMORY_TEST === '1') useMemoryStore();
  else { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); }
  await Workspace.init();
  await Workspace.create({ name: 'Test desk', config, members: [{ id: 'manager', name: 'Manager', email, passwordHash: await bcrypt.hash(password, 4), role: 'manager', availability: [], exceptions: [] }] });
  app = createApp(engine); manager = request.agent(app); da = request.agent(app);
});
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
const post = (agent, route, body = {}) => agent.post('/api'+route).set('Origin', origin).send(body);
test('full manager and DA lifecycle with permissions and revision protection', async () => {
  assert.equal((await request(app).get('/api/state')).status, 401);
  assert.equal((await request(app).post('/api/login').send({ email, password })).status, 403);
  assert.equal((await post(manager, '/login', { email, password })).status, 200);
  let state = (await manager.get('/api/state')).body;
  assert.equal(state.members[0].passwordHash, undefined);
  let r = await post(manager, '/members', { revision: state.revision, name: 'DA', email: 'da@test.example', password });
  assert.equal(r.status, 200); state = r.body;
  assert.equal((await post(da, '/login', { email: 'da@test.example', password })).status, 200);
  assert.equal((await post(da, '/members', { revision: state.revision })).status, 403);
  r = await da.put('/api/availability').set('Origin', origin).send({ revision: state.revision, availability: [{ day: 1, start: 480, end: 720 }], exceptions: [], nightPreference: false });
  assert.equal(r.status, 200); state = r.body;
  assert.equal(state.members.find(m => m.role === 'manager').email, undefined);
  r = await post(manager, `/plans/${week}/shifts`, { revision: state.revision-1, start: '2026-09-28T08:00:00-04:00', end: '2026-09-28T12:00:00-04:00', required: 1 });
  assert.equal(r.status, 409);
  r = await post(manager, `/plans/${week}/shifts`, { revision: state.revision, start: '2026-09-28T08:00:00-04:00', end: '2026-09-28T12:00:00-04:00', required: 1 });
  assert.equal(r.status, 200); state = r.body;
  assert.equal((await da.get('/api/state')).body.plans[week], undefined);
  assert.equal((await post(manager, `/plans/${week}/publish`, { revision: state.revision })).status, 400);
  r = await post(manager, `/plans/${week}/generate`, { revision: state.revision });
  assert.equal(r.status, 200, JSON.stringify(r.body)); state = r.body;
  assert.equal(state.plans[week].shifts[0].assignees.length, 1);
  r = await post(manager, `/plans/${week}/publish`, { revision: state.revision });
  assert.equal(r.status, 200, JSON.stringify(r.body)); state = r.body;
  assert.equal((await da.get('/api/state')).body.plans[week].status, 'published');
  assert.equal((await post(manager, `/plans/${week}/generate`, { revision: state.revision })).status, 400);
  r = await post(manager, `/plans/${week}/reopen`, { revision: state.revision });
  assert.equal(r.status, 200);
  assert.equal((await da.get('/api/state')).body.plans[week], undefined);
  assert.equal((await post(manager, '/logout')).status, 200);
  assert.equal((await manager.get('/api/state')).status, 401);
});
