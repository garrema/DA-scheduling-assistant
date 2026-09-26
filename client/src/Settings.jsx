import { useState } from 'react';
import { WindowEditor } from './Availability.jsx';
export function Settings({ state, mutate, busy }) {
  const [config, setConfig] = useState(state.config);
  function field(key, value) { setConfig({ ...config, [key]: value }); }
  return <section className="panel"><h2>Neighborhood rules</h2><p className="muted">Rest is measured between separate work periods. Adjacent blocks count as continuous work.</p>
    <div className="form-grid">
      <label>Timezone<input value={config.timezone} onChange={e => field('timezone', e.target.value)} /></label>
      {[['maxHours', 'Maximum weekly hours', 1, 20], ['targetHours', 'Target weekly hours', 0, 20], ['maxContinuousHours', 'Maximum continuous hours', 1, 6], ['minRestHours', 'Minimum rest hours', 1, 24]].map(([key, title, min, max]) => <label key={key}>{title}<input type="number" min={min} max={max} value={config[key]} onChange={e => field(key, Number(e.target.value))} /></label>)}
      <div><p className="small">Allowed shift lengths (hours)</p><div className="chips">{[1, 2, 3, 4, 5, 6].map(h => <label className="check" key={h}><input type="checkbox" checked={(config.allowedShiftHours || [2, 4, 6]).includes(h)} onChange={e => field('allowedShiftHours', e.target.checked ? [...(config.allowedShiftHours || [2, 4, 6]), h].sort() : (config.allowedShiftHours || [2, 4, 6]).filter(n => n !== h))} />{h}</label>)}</div><span className="muted small">Include 1 for odd-hour DST coverage.</span></div>
    </div><h3>Operating hours</h3><WindowEditor windows={config.openHours} setWindows={value => field('openHours', value)} />
    <p className="muted">For 24-hour operation use 00:00 through midnight on each day. A closing time of 20:00 is 8 p.m.</p>
    <button disabled={busy} onClick={() => mutate('/config', 'PUT', { config })}>Save rules</button>
  </section>;
}
export function Team({ state, mutate, busy }) {
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  async function add(e) {
    e.preventDefault();
    if (await mutate('/members', 'POST', { name, email, password })) { setName(''); setEmail(''); setPassword(''); }
  }
  return <section className="panel"><h2>Desk assistants</h2><p className="muted">Each DA signs in and enters their own availability. New accounts start unavailable.</p>
    <form className="form-row" onSubmit={add}><label>Name<input required value={name} onChange={e => setName(e.target.value)} /></label><label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Initial password<input type="password" minLength={12} maxLength={72} required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy}>Add DA</button></form>
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Availability windows</th><th>Night preference</th></tr></thead><tbody>{state.members.filter(m => m.role === 'da').map(m => <tr key={m.id}><td>{m.name}</td><td>{m.email}</td><td>{m.availability.length}</td><td>{m.nightPreference ? 'Prefers nights' : 'No preference'}</td></tr>)}</tbody></table></div>
  </section>;
}
export function Account({ mutate, busy }) {
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState('');
  return <section className="panel"><h2>Change password</h2><form className="form-row" onSubmit={async e => { e.preventDefault(); if (await mutate('/password', 'POST', { currentPassword, newPassword })) { setCurrent(''); setNew(''); } }}><label>Current password<input type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label><label>New password<input type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={newPassword} onChange={e => setNew(e.target.value)} /></label><button disabled={busy}>Update password</button></form></section>;
}
