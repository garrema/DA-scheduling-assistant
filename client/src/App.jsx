import { useEffect, useState } from 'react';
import { api } from './api.js';
import { monday } from './time.js';
import Schedule from './Schedule.jsx';
import Availability from './Availability.jsx';
import { Settings, Team, Account } from './Settings.jsx';
export default function App() {
  const [state, setState] = useState(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('Schedule'), [week, setWeek] = useState('');
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  async function load() {
    const data = await api('/state'); setState(data); setWeek(w => w || monday(data.config.timezone));
  }
  useEffect(() => { load().catch(e => { if (e.message !== 'Please sign in') setError(e.message); }).finally(() => setLoading(false)); }, []);
  async function login(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/login', 'POST', { email, password }); setPassword(''); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function mutate(path, method, body = {}) {
    setBusy(true); setError(''); setNotice('');
    try { const data = await api(path, method, { ...body, revision: state.revision }); setState(data); setNotice('Saved successfully.'); return true; }
    catch (e) { setError(e.message); return false; } finally { setBusy(false); }
  }
  if (loading) return <main className="loading">Loading Deskwise…</main>;
  if (!state) return <main className="login-page"><div className="login-story"><div className="brand">▦ Deskwise</div><p className="eyebrow">DESK ASSISTANT SCHEDULING</p><h1>Coverage that fits<br />your people.</h1><p>Availability, thoughtful assignments, and a clear plan for every desk.</p><div className="story-note">Built for neighborhood teams.<br />Reviewed by managers. Guided by real constraints.</div></div><section className="login-card"><h2>Welcome back</h2><p className="muted">Sign in with the account your manager created.</p><form onSubmit={login}><label>Email<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p className="error" role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form><p className="small muted">First setup? Follow README.md to create your manager account.</p></section></main>;
  const manager = state.me.role === 'manager';
  const tabs = manager ? ['Schedule', 'Team', 'Rules', 'Account'] : ['Schedule', 'Availability', 'Account'];
  return <div className="app-shell"><aside><div className="brand">▦ Deskwise</div><p className="sidebar-label">{state.name}</p><nav aria-label="Main navigation">{tabs.map(t => <button className={tab === t ? 'active' : ''} key={t} onClick={() => { setTab(t); setError(''); setNotice(''); }}>{t}</button>)}</nav><div className="sidebar-bottom"><strong>{state.me.name}</strong><span>{state.me.role === 'manager' ? 'Neighborhood manager' : 'Desk assistant'}</span><button onClick={async () => { try { await api('/logout', 'POST', {}); setState(null); setTab('Schedule'); setNotice(''); } catch (e) { setError(e.message); } }}>Sign out</button></div></aside>
    <main className="workspace"><header className="topbar"><span>Neighborhood operations / {tab}</span><button className="text-button" disabled={busy} onClick={() => load().then(() => { setError(''); setNotice('Refreshed.'); }).catch(e => setError(e.message))}>Refresh</button></header>
    {error && <div role="alert" className="banner error">{error}</div>}{notice && <div role="status" className="banner success">{notice}</div>}
    <fieldset disabled={busy} className="content-fieldset">
      {tab === 'Schedule' && <Schedule key={week} state={state} week={week} setWeek={setWeek} mutate={mutate} busy={busy} report={setError} />}
      {tab === 'Availability' && <Availability key={state.revision} member={state.members.find(m => m.id === state.me.id)} zone={state.config.timezone} mutate={mutate} busy={busy} />}
      {tab === 'Team' && <Team state={state} mutate={mutate} busy={busy} />}
      {tab === 'Rules' && <Settings key={state.revision} state={state} mutate={mutate} busy={busy} />}
      {tab === 'Account' && <Account mutate={mutate} busy={busy} />}
    </fieldset><footer>Deskwise · Scheduling support with manager approval</footer></main></div>;
}
