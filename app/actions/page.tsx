'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { actionBucket } from '@/lib/benefit-actions';

type ActionItem = {
  id: string; type: string; priority: string; status: string; dueAt: string | null; expiresAt: string | null;
  snoozedUntil: string | null; voucher: { id: string; merchantName: string; title: string } | null;
};
type Response = { items: ActionItem[]; badgeCount: number; error?: string };

const sections = [
  ['NOW', 'Jetzt erledigen'], ['UPCOMING', 'Demnächst'], ['REVIEW', 'Zur Prüfung'], ['DONE', 'Erledigt']
] as const;

export default function ActionsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/actions', { cache: 'no-store' });
      const payload = await response.json() as Response;
      if (!response.ok) throw new Error(payload.error ?? 'Aufgaben konnten nicht geladen werden.');
      setItems(payload.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Aufgaben konnten nicht geladen werden.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function update(id: string, action: 'SNOOZE' | 'DISMISS', minutes?: number) {
    setBusy(id); setError('');
    try {
      const response = await fetch('/api/actions', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action, resumeAt: minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : undefined }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Aufgabe konnte nicht aktualisiert werden.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Aufgabe konnte nicht aktualisiert werden.'); }
    finally { setBusy(''); }
  }

  return <main><header className="page-header"><div><p className="badge">Handlungsbedarf</p><h1>Aufgaben</h1><p className="muted">Nur aktuell zulässige Aktionen. Der Serverzustand wird beim Öffnen erneut geprüft.</p></div><Link className="header-action" href="/">Zur Übersicht</Link></header>
    {error && <p className="message error-message section-gap" role="alert">{error}</p>}
    {loading ? <section className="card empty-state section-gap" aria-live="polite"><h2>Aufgaben werden geladen …</h2></section> : sections.map(([bucket, title]) => {
      const grouped = items.filter(item => actionBucket({ ...item, dueAt: item.dueAt ? new Date(item.dueAt) : null, expiresAt: item.expiresAt ? new Date(item.expiresAt) : null, snoozedUntil: item.snoozedUntil ? new Date(item.snoozedUntil) : null }) === bucket);
      if (!grouped.length) return null;
      return <section className="section-gap" key={bucket}><h2>{title}</h2><div className="action-inbox-list">{grouped.map(item => <article className="card" key={item.id}><div><p className="badge">{priorityLabel(item.priority)}</p><h3>{actionTitle(item.type)}</h3><p>{actionText(item)}</p>{item.expiresAt && <p className="muted">Frist: {dateTime(item.expiresAt)}</p>}</div><div className="action-stack"><Link className="primary" href={item.voucher ? `/vouchers/${item.voucher.id}` : '/vouchers'}>Gutschein öffnen</Link>{['OPEN', 'SNOOZED'].includes(item.status) && <><button className="button-secondary" disabled={busy === item.id} onClick={() => update(item.id, 'SNOOZE', 30)}>In 30 Min. erinnern</button><button className="button-quiet" disabled={busy === item.id} onClick={() => update(item.id, 'DISMISS')}>Ausblenden</button></>}</div></article>)}</div></section>;
    })}
    {!items.length && <section className="card empty-state section-gap"><h2>Alles erledigt</h2><p className="muted">Aktuell gibt es keine offenen Aufgaben.</p></section>}
  </main>;
}
function actionTitle(type: string) { return ({ ACCEPT_TRANSFER: 'Übertragung entscheiden', TRANSFER_EXPIRING: 'Übertragung läuft bald ab', RESERVATION_EXPIRING: 'Reservierung läuft bald ab' } as Record<string, string>)[type] ?? 'Gutschein prüfen'; }
function actionText(item: ActionItem) { const name = item.voucher ? `${item.voucher.merchantName}: ${item.voucher.title}` : 'Dieser Gutschein'; if (item.type === 'ACCEPT_TRANSFER') return `${name} wurde dir übertragen. Bitte annehmen oder ablehnen.`; if (item.type === 'TRANSFER_EXPIRING') return `${name} wartet nur noch kurz auf eine Entscheidung.`; return `${name} ist noch reserviert. Löse ihn jetzt ein oder gib die Reservierung frei.`; }
function priorityLabel(priority: string) { return ({ CRITICAL: 'Zeitkritisch', HIGH: 'Wichtig', NORMAL: 'Offen', LOW: 'Prüfen' } as Record<string, string>)[priority] ?? 'Offen'; }
function dateTime(value: string) { return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
