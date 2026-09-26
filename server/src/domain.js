import { DateTime } from 'luxon';
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function weekBounds(week, zone) {
  const start = DateTime.fromISO(week, { zone });
  if (!start.isValid || start.weekday !== 1 || start.toISODate() !== week) fail('Choose a valid Monday');
  return { start, end: start.plus({ days: 7 }) };
}
const mins = date => Math.floor(date.toMillis() / 60000);
export function expand(windows, start) {
  return windows.map(w => {
    const day = start.plus({ days: w.day - 1 });
    // Local clock times, not elapsed minutes, preserve availability over DST changes.
    const clock = value => value === 1440 ? day.plus({ days: 1 }).startOf('day') : day.set({ hour: Math.floor(value / 60), minute: value % 60 });
    return { start: mins(clock(w.start)), end: mins(clock(w.end)) };
  });
}
export function checkShift(shift, week, config) {
  const { start, end } = weekBounds(week, config.timezone);
  const a = DateTime.fromISO(shift.start), b = DateTime.fromISO(shift.end);
  const duration = b.diff(a, 'minutes').minutes;
  if (a < start || b > end || !(config.allowedShiftHours || [2, 4, 6]).map(h => h*60).includes(duration)) fail('Use an allowed elapsed shift length entirely within this week');
  if (duration > config.maxContinuousHours * 60) fail('Shift exceeds configured continuous-work limit');
  if (a.second || b.second || a.millisecond || b.millisecond) fail('Use whole-minute shift times');
  const openings = expand(config.openHours, start).sort((x, y) => x.start-y.start);
  let covered = mins(a);
  for (const window of openings) if (window.start <= covered && window.end > covered) covered = window.end;
  if (covered < mins(b)) fail('Shift falls outside neighborhood operating hours');
}
export function isNight(shift, zone) {
  // A shift is a night shift when any elapsed minute is between 22:00 and 06:00 locally.
  for (let t = Date.parse(shift.start); t < Date.parse(shift.end); t += 60000) {
    const hour = DateTime.fromMillis(t, { zone }).hour;
    if (hour >= 22 || hour < 6) return true;
  }
  return false;
}
export function problemFor(workspace, week, shifts = workspace.plans[week]?.shifts || []) {
  const { start, end } = weekBounds(week, workspace.config.timezone);
  const published = Object.entries(workspace.plans).filter(([key, plan]) => key !== week && plan.status === 'published');
  const employees = workspace.members.filter(m => m.role === 'da').map(m => ({
    id: m.id, name: m.name, availability: expand(m.availability, start),
    exceptions: m.exceptions.map(x => ({ start: Math.floor(Date.parse(x.start)/60000), end: Math.floor(Date.parse(x.end)/60000) })),
    nightPreference: m.nightPreference,
    previousNightMinutes: published.filter(([key]) => key < week && key >= start.minus({ weeks: 4 }).toISODate()).flatMap(([, p]) => p.shifts)
      .filter(s => s.assignees.includes(m.id) && isNight(s, workspace.config.timezone)).reduce((n, s) => n+(Date.parse(s.end)-Date.parse(s.start))/60000, 0),
  }));
  const existing = published.flatMap(([, p]) => p.shifts).filter(s => Date.parse(s.end) >= start.minus({ hours: 24 }).toMillis() && Date.parse(s.start) <= end.plus({ hours: 24 }).toMillis())
    .flatMap(s => s.assignees.map(employeeId => ({ employeeId, start: Math.floor(Date.parse(s.start)/60000), end: Math.floor(Date.parse(s.end)/60000) })));
  return { employees, shifts: shifts.map(s => ({ ...s, start: Math.floor(Date.parse(s.start)/60000), end: Math.floor(Date.parse(s.end)/60000), night: isNight(s, workspace.config.timezone) })), existing, rules: workspace.config, weekStart: mins(start), weekEnd: mins(end) };
}
export function publicState(workspace, viewer) {
  const members = workspace.members.map(({ passwordHash, ...m }) => viewer.role === 'manager' || m.id === viewer.id ? m : { id: m.id, name: m.name, role: m.role });
  const plans = Object.fromEntries(Object.entries(workspace.plans).filter(([, p]) => viewer.role === 'manager' || p.status === 'published'));
  return { id: String(workspace._id), name: workspace.name, revision: workspace.revision, config: workspace.config, members, plans, me: { id: viewer.id, name: viewer.name, role: viewer.role } };
}
export async function callEngine(path, problem) {
  const response = await fetch(`${process.env.SCHEDULER_URL || 'http://127.0.0.1:8000'}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Scheduler-Key': process.env.SCHEDULER_KEY || '' },
    body: JSON.stringify(problem), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) fail('Scheduling service rejected the request. Check service configuration and input limits.', 502);
  return response.json();
}

export function missingCoverage(workspace, week, shifts) {
  const { start } = weekBounds(week, workspace.config.timezone);
  const blocks = shifts.map(s => ({ start: Math.floor(Date.parse(s.start)/60000), end: Math.floor(Date.parse(s.end)/60000) })).sort((a, b) => a.start-b.start);
  const gaps = [];
  for (const open of expand(workspace.config.openHours, start)) {
    let cursor = open.start;
    for (const block of blocks) {
      if (block.end <= cursor || block.start >= open.end) continue;
      if (block.start > cursor) gaps.push({ start: cursor, end: Math.min(block.start, open.end) });
      cursor = Math.max(cursor, Math.min(block.end, open.end));
    }
    if (cursor < open.end) gaps.push({ start: cursor, end: open.end });
  }
  return gaps.map(g => `${DateTime.fromMillis(g.start*60000).setZone(workspace.config.timezone).toFormat('ccc HH:mm')}–${DateTime.fromMillis(g.end*60000).setZone(workspace.config.timezone).toFormat('ccc HH:mm')}`);
}

export function coverageBlocks(workspace, week) {
  const { start } = weekBounds(week, workspace.config.timezone);
  const allowed = (workspace.config.allowedShiftHours || [2, 4, 6]).filter(h => h <= workspace.config.maxContinuousHours).sort((a, b) => a-b);
  const windows = expand(workspace.config.openHours, start).sort((a, b) => a.start-b.start);
  const merged = [];
  for (const w of windows) {
    const last = merged.at(-1);
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  const blocks = [];
  for (const w of merged) {
    const duration = w.end-w.start;
    const possible = Array(duration+1).fill(false);
    possible[0] = true;
    for (let t = 1; t <= duration; t++) possible[t] = allowed.some(h => t >= h*60 && possible[t-h*60]);
    let cursor = w.start;
    while (cursor < w.end) {
      const length = [...allowed].sort((a, b) => (a === 2 ? -1 : b === 2 ? 1 : b-a)).find(h => h*60 <= w.end-cursor && possible[w.end-cursor-h*60]);
      if (!length) fail('Operating hours cannot be tiled with allowed shift lengths. Adjust hours or lengths (DST weeks may need 1-hour blocks).');
      const end = cursor+length*60;
      blocks.push({ start: new Date(cursor*60000).toISOString(), end: new Date(end*60000).toISOString() });
      cursor = end;
    }
  }
  if (blocks.length > 100) fail('More than 100 blocks required. Increase minimum allowed shift length or add blocks manually.');
  return blocks;
}
