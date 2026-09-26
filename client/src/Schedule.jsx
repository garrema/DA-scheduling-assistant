import { useState } from 'react';
import { DateTime } from 'luxon';
import { localISO, label } from './time.js';
function ShiftRow({ shift, state, week, editable, mutate, busy }) {
  const [assignees, setAssignees] = useState(shift.assignees);
  const [locked, setLocked] = useState(shift.locked);
  const employees = state.members.filter(m => m.role === 'da');
  const shortage = shift.required-shift.assignees.length;
  return <tr><td><strong>{label(shift.start, state.config.timezone)}</strong><br /><span className="muted">to {label(shift.end, state.config.timezone)}</span></td>
    <td>{shift.required}</td><td>{editable ? <div className="assignment-list">{employees.map(m => <label className="check" key={m.id}><input type="checkbox" checked={assignees.includes(m.id)} onChange={e => setAssignees(e.target.checked ? [...assignees, m.id] : assignees.filter(id => id !== m.id))} />{m.name}</label>)}</div> : shift.assignees.map(id => state.members.find(m => m.id === id)?.name || 'Unknown').join(', ')}</td>
    <td><span className={`badge ${shortage ? 'amber' : 'green'}`}>{shortage ? `${shortage} unfilled` : 'Covered'}</span>{editable && <label className="check"><input type="checkbox" checked={locked} onChange={e => setLocked(e.target.checked)} />Lock</label>}</td>
    {editable && <td><div className="actions"><button className="secondary" disabled={busy} onClick={() => mutate(`/plans/${week}/shifts/${shift.id}`, 'PUT', { assignees, locked })}>Save</button><button className="text-button danger" disabled={busy} onClick={() => { if (confirm('Delete this coverage block?')) mutate(`/plans/${week}/shifts/${shift.id}`, 'DELETE'); }}>Delete</button></div></td>}</tr>;
}
export default function Schedule({ state, week, setWeek, mutate, busy, report }) {
  const plan = state.plans[week];
  const manager = state.me.role === 'manager';
  const editable = manager && plan?.status !== 'published';
  const shifts = plan?.shifts || [];
  const [start, setStart] = useState(week+'T08:00');
  const [end, setEnd] = useState(week+'T12:00');
  const [required, setRequired] = useState(1);
  const total = shifts.reduce((n, s) => n+s.required, 0);
  const filled = shifts.reduce((n, s) => n+s.assignees.length, 0);
  async function add(e) {
    e.preventDefault();
    try { await mutate(`/plans/${week}/shifts`, 'POST', { start: localISO(start, state.config.timezone), end: localISO(end, state.config.timezone), required: Number(required) }); }
    catch (error) { report(error.message); }
  }
  function download() {
    const quote = x => `"${String(x).replaceAll('"', '""')}"`;
    // Prefix spreadsheet-formula triggers to prevent CSV formula injection.
    const safe = x => /^[=+@\-\t\r]/.test(x) ? "'"+x : x;
    const rows = [['Start', 'End', 'Timezone', 'Required', 'Assigned', 'Status'], ...shifts.map(s => [label(s.start, state.config.timezone), label(s.end, state.config.timezone), state.config.timezone, s.required, s.assignees.map(id => state.members.find(m => m.id === id)?.name || '').join('; '), plan.status])];
    const url = URL.createObjectURL(new Blob([rows.map(row => row.map(x => quote(safe(String(x)))).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `deskwise-${week}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">WEEKLY PLANNING</p><h1>{manager ? 'Build a better week.' : 'Your neighborhood schedule.'}</h1><p className="muted">All times are {state.config.timezone}, regardless of your device location.</p></div><label>Week beginning (Monday)<input type="date" value={week} onChange={e => { const d = DateTime.fromISO(e.target.value); if (d.isValid) setWeek(d.startOf('week').toISODate()); }} /></label></div>
    <div className="stats"><div><span>Assigned positions</span><strong>{filled}<small> / {total}</small></strong></div><div><span>Unfilled positions</span><strong>{total-filled}</strong></div><div><span>Schedule status</span><strong className="status-text">{plan?.status || 'Not started'}</strong></div></div>
    {manager && <section className="panel"><div className="section-heading"><div><h2>Plan & review</h2><p className="muted">Define coverage blocks, then generate assignments. Save row changes before generating.</p></div><div className="actions">
      {editable ? <><button disabled={busy || !shifts.length} onClick={() => mutate(`/plans/${week}/generate`, 'POST')}>{busy ? 'Working…' : 'Generate schedule'}</button><button className="secondary" disabled={busy || !shifts.length} onClick={() => mutate(`/plans/${week}/publish`, 'POST')}>Publish</button></> : <button className="secondary" disabled={busy} onClick={() => { if (confirm('Reopening hides this week from DAs until you publish again. Continue?')) mutate(`/plans/${week}/reopen`, 'POST'); }}>Reopen draft</button>}
    </div></div>
    {editable && <form className="form-row" onSubmit={add}><label>Shift starts<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label><label>Shift ends<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} /></label><label>DAs required<input type="number" min="1" max="10" required value={required} onChange={e => setRequired(e.target.value)} /></label><button className="secondary" disabled={busy}>Add coverage block</button></form>}
    {editable && !shifts.length && <button className="secondary" disabled={busy} onClick={() => mutate(`/plans/${week}/coverage`, 'POST', { required: Number(required) })}>Create blocks for all operating hours ({required} DA each)</button>}
    <p className="muted small">Allowed elapsed hours: {(state.config.allowedShiftHours || [2, 4, 6]).join(', ')}. Split shifts at the Monday boundary. The app checks every operating period before publishing.</p>
    {plan?.solverStatus && <p className="small">Solver: {plan.solverStatus}. {plan.coverageOptimal ? 'Best possible coverage proven for these blocks and locks.' : 'Time-limited solution; better coverage may exist.'}</p>}
    </section>}
    <section className="panel"><div className="section-heading"><h2>Weekly assignments</h2><button className="secondary" disabled={!shifts.length} onClick={download}>Export CSV</button></div>
      {!shifts.length ? <div className="empty"><h3>{manager ? 'Start with your coverage requirements' : 'No published schedule yet'}</h3><p>{manager ? 'Add the shifts the desk needs covered. DAs must enter availability before assignments can be generated.' : 'Your manager will publish the schedule after review.'}</p></div> : <div className="table-wrap"><table><thead><tr><th>Shift</th><th>Required</th><th>Desk assistants</th><th>Coverage</th>{editable && <th>Actions</th>}</tr></thead><tbody>{shifts.map(s => <ShiftRow key={`${s.id}-${state.revision}`} shift={s} state={state} week={week} editable={editable} mutate={mutate} busy={busy} />)}</tbody></table></div>}
    </section>
    {manager && <section className="panel"><h2>Hours & preferences</h2><div className="table-wrap"><table><thead><tr><th>DA</th><th>This week</th><th>Target</th><th>Night preference</th></tr></thead><tbody>{state.members.filter(m => m.role === 'da').map(m => { const hours = shifts.filter(s => s.assignees.includes(m.id)).reduce((n, s) => n+(Date.parse(s.end)-Date.parse(s.start))/3600000, 0); return <tr key={m.id}><td>{m.name}</td><td>{hours} / {state.config.maxHours} h</td><td>{hours < state.config.targetHours ? `${state.config.targetHours-hours} h below target (allowed)` : 'Target reached'}</td><td>{m.nightPreference ? 'Prefers nights' : 'No preference'}</td></tr>; })}</tbody></table></div></section>}
    {manager && !!plan?.gaps?.length && <section className="panel"><h2>Coverage explanations</h2><p className="muted">Reasons reflect the last generation. Individual eligibility does not guarantee a globally feasible assignment.</p>{plan.gaps.map(g => <details key={g.shiftId}><summary>{label(shifts.find(s => s.id === g.shiftId).start, state.config.timezone)} · {g.missing} unfilled</summary>{g.candidates.length ? g.candidates.map((c, i) => <p key={i}><strong>{c.employee}:</strong> {c.reasons.join('; ')}</p>) : <p>No DAs are registered in this neighborhood.</p>}</details>)}</section>}
  </>;
}
