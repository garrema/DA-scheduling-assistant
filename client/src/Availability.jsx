import { useState } from 'react';
import { DAYS, clock, toMinute, localISO, label } from './time.js';
export function WindowEditor({ windows, setWindows }) {
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('18:00');
  const [midnight, setMidnight] = useState(false);
  const [error, setError] = useState('');
  function add() {
    const a = toMinute(start), b = midnight ? 1440 : toMinute(end);
    if (!Number.isFinite(a+b) || a >= b) return setError('End must be later. Split overnight windows into two days.');
    setWindows([...windows, { day: Number(day), start: a, end: b }]);
    setError('');
  }
  return <div><div className="form-row">
    <label>Day<select value={day} onChange={e => setDay(e.target.value)}>{DAYS.map((d, i) => <option key={d} value={i+1}>{d}</option>)}</select></label>
    <label>From<input type="time" value={start} onChange={e => setStart(e.target.value)} /></label>
    <label>Until<input type="time" disabled={midnight} value={end} onChange={e => setEnd(e.target.value)} /></label>
    <label className="check"><input type="checkbox" checked={midnight} onChange={e => setMidnight(e.target.checked)} />End at midnight</label>
    <button type="button" className="secondary" onClick={add}>Add window</button>
  </div>{error && <p role="alert" className="error">{error}</p>}
  <div className="chips">{windows.map((w, i) => <span className="chip" key={i}>{DAYS[w.day-1]} {clock(w.start)}–{clock(w.end)}<button type="button" aria-label={`Remove ${DAYS[w.day-1]} window`} onClick={() => setWindows(windows.filter((_, n) => n !== i))}>×</button></span>)}</div>
  {!windows.length && <p className="muted">No windows entered.</p>}</div>;
}
export default function Availability({ member, zone, mutate, busy }) {
  const [windows, setWindows] = useState(member.availability || []);
  const [exceptions, setExceptions] = useState(member.exceptions || []);
  const [nightPreference, setNight] = useState(member.nightPreference || false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  function addException() {
    try {
      const a = localISO(start, zone), b = localISO(end, zone);
      if (Date.parse(a) >= Date.parse(b)) throw new Error('End must follow start');
      setExceptions([...exceptions, { start: a, end: b }]); setError('');
    } catch (e) { setError(e.message); }
  }
  return <section className="panel"><h2>When can you work?</h2><p className="muted">All times use {zone}. Everything outside your windows is unavailable. Split overnight availability at midnight.</p>
    <WindowEditor windows={windows} setWindows={setWindows} />
    <label className="check preference"><input type="checkbox" checked={nightPreference} onChange={e => setNight(e.target.checked)} />I prefer night shifts (22:00–06:00)</label>
    <h3>Date-specific unavailability</h3><p className="muted">Exceptions override weekly availability.</p>
    <div className="form-row"><label>From<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label><label>Until<input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label><button className="secondary" onClick={addException}>Add exception</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {exceptions.map((x, i) => <div className="exception" key={i}><span>{label(x.start, zone)} → {label(x.end, zone)}</span><button className="text-button" onClick={() => setExceptions(exceptions.filter((_, n) => i !== n))}>Remove</button></div>)}
    <button disabled={busy} onClick={() => mutate('/availability', 'PUT', { availability: windows, exceptions, nightPreference })}>Save availability</button>
    <p className="muted small">Changes conflicting with future published shifts require manager review; they are not silently applied.</p>
  </section>;
}
