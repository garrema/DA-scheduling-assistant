import test from 'node:test';
import assert from 'node:assert/strict';
import { weekBounds, expand, checkShift, missingCoverage, problemFor } from '../src/domain.js';
const config = { timezone: 'America/New_York', maxHours: 20, targetHours: 10, maxContinuousHours: 6, minRestHours: 8, openHours: [{ day: 1, start: 480, end: 1200 }] };
test('rejects non-Monday week', () => assert.throws(() => weekBounds('2026-09-29', config.timezone)));
test('local clock expansion preserves 8 am after DST transition', () => {
  const { start, end } = weekBounds('2026-03-02', config.timezone);
  assert.equal(end.diff(start, 'hours').hours, 167);
  const window = expand([{ day: 7, start: 480, end: 600 }], start)[0];
  assert.equal(new Date(window.start*60000).toISOString(), '2026-03-08T12:00:00.000Z');
});
test('closing at 8 pm is enforced', () => {
  assert.throws(() => checkShift({ start: '2026-09-28T19:00:00-04:00', end: '2026-09-28T21:00:00-04:00' }, '2026-09-28', config));
});
test('undefined operating periods cannot be hidden by fully assigned blocks', () => {
  const gaps = missingCoverage({ config }, '2026-09-28', [{ start: '2026-09-28T08:00:00-04:00', end: '2026-09-28T12:00:00-04:00' }]);
  assert.equal(gaps.length, 1); assert.match(gaps[0], /12:00/);
});
test('cross-week published commitments and night history are passed to solver', () => {
  const workspace = { config, members: [{ id: 'a', name: 'A', role: 'da', availability: [], exceptions: [] }], plans: { '2026-09-21': { status: 'published', shifts: [{ start: '2026-09-27T22:00:00-04:00', end: '2026-09-28T00:00:00-04:00', assignees: ['a'] }] } } };
  const p = problemFor(workspace, '2026-09-28', []);
  assert.equal(p.existing.length, 1); assert.equal(p.employees[0].previousNightMinutes, 120);
});
test('automatic coverage produces a normal 24/7 week and respects allowed durations', async () => {
  const { coverageBlocks } = await import('../src/domain.js');
  const full = { config: { ...config, openHours: Array.from({ length: 7 }, (_, i) => ({ day:i+1,start:0,end:1440 })) } };
  assert.equal(coverageBlocks(full,'2026-09-28').length,84);
  const onlyThree = { config: { ...config, allowedShiftHours:[2,3], openHours:[{day:1,start:480,end:660}] } };
  assert.equal(coverageBlocks(onlyThree,'2026-09-28').length,1);
});
test('DST operating week can be tiled when one-hour shifts are explicitly allowed', async () => {
  const { coverageBlocks } = await import('../src/domain.js');
  const full = { config: { ...config, allowedShiftHours:[1,2,4,6], openHours:Array.from({length:7},(_,i)=>({day:i+1,start:0,end:1440})) } };
  const blocks = coverageBlocks(full,'2026-03-02');
  assert.equal(blocks.reduce((n,s)=>n+(Date.parse(s.end)-Date.parse(s.start))/3600000,0),167);
});
