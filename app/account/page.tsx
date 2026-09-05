'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AccountPage() {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [devices, setDevices] = useState<Array<{ id: string; name: string | null; lastSeenAt: string; current: boolean }>>([]);
  const [takeOverNeeded, setTakeOverNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void fetch('/api/auth/session').then(async response => {
    if (!response.ok) return;
    const payload = await response.json();
    setSignedIn(payload.authenticated);
    setEmail(payload.user?.email ?? '');
    void loadDevices();
  }); }, []);

  async function loadDevices() {
    const response = await fetch('/api/auth/devices', { cache: 'no-store' });
    if (response.ok) setDevices((await response.json()).devices);
  }

  async function submit(takeOver = false) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(mode === 'LOGIN' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, takeOver })
      });
      const payload = await response.json();
      if (response.status === 409) { setTakeOverNeeded(true); throw new Error('Auf einem anderen Gerät ist noch eine Sitzung aktiv.'); }
      if (!response.ok) throw new Error(payload.error ?? 'Vorgang fehlgeschlagen.');
      if (mode === 'LOGIN') { setSignedIn(true); setTakeOverNeeded(false); setMessage('Anmeldung erfolgreich.'); await loadDevices(); }
      else { setMessage(payload.message); setMode('LOGIN'); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Vorgang fehlgeschlagen.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); await fetch('/api/auth/logout', { method: 'POST' });
    setSignedIn(false); setPassword(''); setMessage('Abgemeldet.'); setBusy(false);
  }

  async function removeDevice(id: string) {
    setBusy(true); setError('');
    const response = await fetch('/api/auth/devices', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id })
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? 'Gerät konnte nicht entfernt werden.');
    else if (payload.currentRemoved) { setSignedIn(false); setMessage('Dieses Gerät wurde entfernt. Bitte erneut anmelden.'); }
    else await loadDevices();
    setBusy(false);
  }

  return <main className="account-shell">
    <p className="badge">Benutzerkonto</p><h1>Anmeldung</h1>
    {signedIn ? <section className="card account-card">
      <p>Angemeldet als <strong>{email}</strong></p>
      <p className="muted">Eine gleichzeitige Sitzung, maximal fünf registrierte Geräte.</p>
      <h2>Registrierte Geräte ({devices.length}/5)</h2>
      <div className="device-list">{devices.map(device => <div className="device-row" key={device.id}>
        <div><strong>{device.name || 'Browser'}{device.current ? ' (dieses Gerät)' : ''}</strong><span className="muted block">Zuletzt aktiv: {new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(device.lastSeenAt))}</span></div>
        <button className="button-quiet" disabled={busy} onClick={() => removeDevice(device.id)}>Entfernen</button>
      </div>)}</div>
      {error && <p className="message error-message" role="alert">{error}</p>}
      <div className="candidate-actions"><Link className="button-link button-secondary" href="/">Zum Dashboard</Link><button className="primary" onClick={logout} disabled={busy}>Abmelden</button></div>
    </section> : <section className="card account-card">
      <div className="mode-switch"><button className={mode === 'LOGIN' ? 'primary' : 'button-quiet'} onClick={() => setMode('LOGIN')}>Anmelden</button><button className={mode === 'REGISTER' ? 'primary' : 'button-quiet'} onClick={() => setMode('REGISTER')}>Konto anlegen</button></div>
      <label>E-Mail-Adresse<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Passwort<input type="password" autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="primary full-button" disabled={busy || !email || password.length < (mode === 'LOGIN' ? 8 : 10)} onClick={() => submit()}>{busy ? 'Bitte warten…' : mode === 'LOGIN' ? 'Anmelden' : 'Konto anlegen'}</button>
      {takeOverNeeded && <button className="button-secondary full-button" disabled={busy} onClick={() => submit(true)}>Andere Sitzung beenden und hier anmelden</button>}
      {error && <p className="message error-message" role="alert">{error}</p>}
      {message && <p className="message success-message" role="status">{message}</p>}
    </section>}
  </main>;
}
