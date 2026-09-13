'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Detail = { id:string; merchantName:string; title:string; validUntil:string|null; accessRole:string; canReserve:boolean; canReleaseReservation:boolean; canTransfer:boolean; canAcceptTransfer:boolean; reservation:{ id:string; userId:string; expiresAt:string; user:{ email:string } }|null; transfer:{ id:string; sender:{ email:string }; recipient:{ email:string }|null; expiresAt:string|null }|null; transferRecipients:{ id:string; label:string }[]; auditEvents:{ id:string; action:string; createdAt:string; actor:{ email:string }|null }[] };
type Action = 'reserve' | 'release' | 'transfer' | 'accept' | 'decline' | 'cancel' | 'verify';

export default function VoucherDetailPage({ params }: { params: Promise<{ id:string }> }) {
  const [id, setId] = useState('');
  const [voucher, setVoucher] = useState<Detail|null>(null);
  const [busy, setBusy] = useState<Action|null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [recipient, setRecipient] = useState('');
  const [reserveOpen, setReserveOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { void params.then(value => setId(value.id)); }, [params]);
  const load = useCallback(async () => {
    if (!id) return null;
    const response = await fetch(`/api/vouchers/${id}`, { cache:'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Gutschein konnte nicht geladen werden.');
    setVoucher(payload.voucher);
    return payload.voucher as Detail;
  }, [id]);

  useEffect(() => { void load().catch(caught => setError(caught instanceof Error ? caught.message : 'Gutschein konnte nicht geladen werden.')); }, [load]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void load().catch(() => setError('Der aktuelle Serverzustand konnte nicht bestätigt werden.'));
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [load]);

  async function verifyAfterUnknownResult() {
    setBusy('verify');
    setError('');
    setInfo('Status wird geprüft …');
    try {
      await load();
      setInfo('Der aktuelle Serverzustand wurde neu geladen.');
    } catch {
      setError('Der aktuelle Status kann momentan nicht bestätigt werden. Es wurde keine zweite Aktion ausgelöst.');
      setInfo('');
    } finally {
      setBusy(null);
    }
  }

  async function action(kind:Action) {
    if (!voucher || busy || kind === 'verify') return;
    if (kind === 'transfer' && !window.confirm('Der Gutschein wird nach Annahme dem ausgewählten Familienmitglied gehören. Übertragung jetzt senden?')) return;
    setBusy(kind); setError(''); setInfo('');
    try {
      const target = kind === 'accept' || kind === 'decline'
        ? `/api/transfers/${voucher.transfer?.id}/${kind}`
        : kind === 'cancel' ? `/api/vouchers/${voucher.id}/transfer?transferId=${voucher.transfer?.id}`
          : kind === 'reserve' || kind === 'release' ? `/api/vouchers/${voucher.id}/reservation` : `/api/vouchers/${voucher.id}/transfer`;
      const method = kind === 'release' || kind === 'cancel' ? 'DELETE' : 'POST';
      let response: Response;
      try {
        response = await fetch(target, { method, headers:{'content-type':'application/json'}, body: kind === 'transfer' ? JSON.stringify({ recipientUserId:recipient }) : kind === 'reserve' ? JSON.stringify({ expiresInMinutes:30 }) : undefined });
      } catch {
        setBusy(null);
        await verifyAfterUnknownResult();
        return;
      }
      const payload = response.status === 204 ? {} : await response.json();
      if (!response.ok) throw new Error(userMessage(payload.error));
      setReserveOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Die Aktion konnte nicht bestätigt werden. Bitte den aktuellen Stand laden.');
    } finally {
      setBusy(null);
    }
  }

  const remainingMs = voucher?.reservation ? new Date(voucher.reservation.expiresAt).getTime() - now : null;
  const countdown = useMemo(() => remainingMs == null ? null : formatRemaining(Math.max(0, remainingMs)), [remainingMs]);
  const countdownA11y = useMemo(() => remainingMs == null ? null : accessibleRemaining(Math.max(0, remainingMs)), [remainingMs == null ? null : Math.ceil(Math.max(0, remainingMs) / 60_000)]);

  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && busy === null) {
      setInfo('Ablauf wird geprüft …');
      void load().then(() => setInfo('')).catch(() => setError('Der Ablaufstatus konnte nicht bestätigt werden.'));
    }
  }, [remainingMs !== null && remainingMs <= 0, busy, load]);

  if (!voucher) return <main><p>{error || 'Gutschein wird geladen …'}</p></main>;
  const isRecipient = voucher.canAcceptTransfer;
  return <main className="detail-shell"><Link className="header-action" href="/vouchers">← Zu meinen Gutscheinen</Link><header className="page-header section-gap"><div><p className="badge">{roleLabel(voucher.accessRole)}</p><h1>{voucher.merchantName}: {voucher.title}</h1><p className="muted">Gültig bis {date(voucher.validUntil)}</p></div></header>{error && <p className="message error-message" role="alert">{error}</p>}{info && <p className="message" role="status">{info}</p>}
    <section className="card section-gap"><h2>Aktueller Status</h2>{voucher.transfer ? <p>{isRecipient ? `Übertragung von ${voucher.transfer.sender.email}: Bitte vor ${dateTime(voucher.transfer.expiresAt)} entscheiden.` : `Übertragung ausstehend. Wartet auf Annahme durch ${voucher.transfer.recipient?.email ?? 'den Empfänger'}.`}</p> : voucher.reservation ? <><p>Reserviert von {voucher.reservation.user.email} bis {dateTime(voucher.reservation.expiresAt)}.</p><p aria-hidden="true"><strong>{countdown}</strong> verbleibend</p><p className="sr-only">{countdownA11y}</p></> : <p>Der Gutschein ist derzeit verfügbar.</p>}</section>
    <section className="card section-gap"><h2>Aktionen</h2><div className="action-stack">{voucher.canReleaseReservation ? <><button className="primary" disabled={busy !== null}>Jetzt einlösen</button><button className="button-secondary" disabled={busy !== null} onClick={() => void action('release')}>{busy === 'release' ? 'Wird freigegeben …' : 'Reservierung freigeben'}</button></> : voucher.canReserve ? <button className="primary" disabled={busy !== null} onClick={() => setReserveOpen(true)}>Für 30 Minuten reservieren</button> : <p className="muted">Eine Reservierung ist derzeit nicht möglich. Der aktuelle Serverzustand entscheidet.</p>}{voucher.canAcceptTransfer && <><button className="primary" disabled={busy !== null} onClick={() => void action('accept')}>{busy === 'accept' ? 'Wird übernommen …' : 'Übertragung annehmen'}</button><button className="button-secondary" disabled={busy !== null} onClick={() => void action('decline')}>{busy === 'decline' ? 'Wird abgelehnt …' : 'Übertragung ablehnen'}</button></>}{voucher.transfer && !isRecipient && <button className="button-secondary" disabled={busy !== null} onClick={() => void action('cancel')}>{busy === 'cancel' ? 'Wird zurückgezogen …' : 'Übertragung zurückziehen'}</button>}{voucher.canTransfer && <div><label htmlFor="recipient">An Familienmitglied übertragen</label><select id="recipient" value={recipient} onChange={event => setRecipient(event.target.value)}><option value="">Empfänger auswählen</option>{voucher.transferRecipients.map(person => <option value={person.id} key={person.id}>{person.label}</option>)}</select><button className="button-secondary section-gap-small" disabled={!recipient || busy !== null} onClick={() => void action('transfer')}>{busy === 'transfer' ? 'Wird gesendet …' : 'Übertragung senden'}</button></div>}</div></section>
    {reserveOpen && <div className="reservation-sheet-overlay" role="presentation" onClick={() => busy === null && setReserveOpen(false)}><section className="reservation-sheet" role="dialog" aria-modal="true" aria-labelledby="reserve-title" onClick={event => event.stopPropagation()}><h2 id="reserve-title">Gutschein reservieren</h2><p>Du reservierst diesen Gutschein für 30 Minuten. Andere berechtigte Familienmitglieder können ihn in dieser Zeit nicht gleichzeitig verwenden.</p><div className="action-stack"><button className="primary" disabled={busy !== null} onClick={() => void action('reserve')}>{busy === 'reserve' ? 'Wird reserviert …' : 'Reservieren'}</button><button className="button-secondary" disabled={busy !== null} onClick={() => setReserveOpen(false)}>Abbrechen</button></div></section></div>}
    <section className="card section-gap"><h2>Verlauf</h2><ol className="audit-list">{voucher.auditEvents.map(event => <li key={event.id}><strong>{auditLabel(event.action)}</strong><span>{event.actor?.email ?? 'System'} · {dateTime(event.createdAt)}</span></li>)}</ol>{!voucher.auditEvents.length && <p className="muted">Noch keine Lifecycle-Ereignisse.</p>}</section></main>;
}
function userMessage(message: unknown) { const text = typeof message === 'string' ? message : ''; if (/reserviert|übertragen|abgelaufen/i.test(text)) return `${text} Bitte lade den Gutschein erneut.`; if (/offene Übertragung/i.test(text)) return 'Die Übertragung ist nicht mehr offen. Bitte lade den Gutschein erneut.'; return text || 'Die Aktion konnte nicht bestätigt werden. Bitte lade den Gutschein erneut.'; }
function roleLabel(role:string) { return role === 'OWNER' ? 'Besitzer' : role === 'MEMBER' ? 'Gemeinsam nutzbar' : 'Nur ansehen'; }
function auditLabel(action:string) { return ({ RESERVED:'Reserviert', RELEASED:'Reservierung freigegeben', TRANSFER_STARTED:'Übertragung gestartet', TRANSFER_CANCELLED:'Übertragung abgelehnt oder zurückgezogen', TRANSFER_ACCEPTED:'Übertragung angenommen', REDEEMED:'Eingelöst', EXPIRED:'Abgelaufen', ARCHIVED:'Archiviert' } as Record<string,string>)[action] ?? 'Status geändert'; }
function date(value:string|null) { return value ? new Intl.DateTimeFormat('de-DE').format(new Date(value)) : 'unbefristet'; }
function dateTime(value:string|null) { return value ? new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'ohne Ablaufzeit'; }
function formatRemaining(ms:number) { const total = Math.ceil(ms / 1000); const minutes = Math.floor(total / 60); const seconds = total % 60; return `${minutes}:${String(seconds).padStart(2,'0')}`; }
function accessibleRemaining(ms:number) { const minutes = Math.max(0, Math.ceil(ms / 60_000)); return minutes <= 1 ? 'Die Reservierung läuft in etwa einer Minute ab.' : `Die Reservierung läuft in etwa ${minutes} Minuten ab.`; }
