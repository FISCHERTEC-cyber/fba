'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type VoucherKind = 'VALUE' | 'DISCOUNT' | 'SERVICE' | 'CASHBACK' | 'STORE_CREDIT' | 'LOYALTY';
type Extraction = {
  merchantName: string; title: string; kind: VoucherKind; valueAmount?: number; currency: string;
  discountPercent?: number; code?: string; validUntil?: string; minimumOrderValue?: number;
  redemptionUrl?: string; terms?: string; physicalVoucher: boolean; storageLocation?: string;
  eventMonitoringEnabled: boolean; sourceType: 'EMAIL'; sourceReference?: string;
  confidence: { overall: number; fields: Record<string, number> };
};
type ReviewFlag = { field: string; confidence: number; reason: string };
type Candidate = {
  id: string; sender: string; subject: string; receivedAt: string;
  analysis: { extraction: Extraction; reviewFlags: ReviewFlag[]; reviewRequired: boolean };
};

export default function ImportCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [confirmed, setConfirmed] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/import-candidates', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Importe konnten nicht geladen werden.');
      setCandidates(payload.candidates);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Importe konnten nicht geladen werden.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function update<K extends keyof Extraction>(id: string, field: K, value: Extraction[K]) {
    setCandidates(current => current.map(candidate => candidate.id === id ? {
      ...candidate,
      analysis: { ...candidate.analysis, extraction: { ...candidate.analysis.extraction, [field]: value } }
    } : candidate));
    confirm(id, field);
  }

  function confirm(id: string, field: string) {
    setConfirmed(current => ({
      ...current,
      [id]: current[id]?.includes(field) ? current[id] : [...(current[id] ?? []), field]
    }));
  }

  function toggleConfirmation(id: string, field: string) {
    setConfirmed(current => ({
      ...current,
      [id]: current[id]?.includes(field)
        ? current[id].filter(item => item !== field)
        : [...(current[id] ?? []), field]
    }));
  }

  async function act(candidate: Candidate, action: 'IMPORT' | 'DISMISS') {
    const confirmations = confirmed[candidate.id] ?? [];
    const pending = candidate.analysis.reviewFlags.filter(flag => !confirmations.includes(flag.field));
    if (action === 'IMPORT' && pending.length) {
      setError(`${pending.length} unsichere Angabe(n) müssen bestätigt werden.`);
      return;
    }
    setBusy(candidate.id);
    setError('');
    try {
      const response = await fetch(`/api/import-candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'DISMISS'
          ? { action }
          : { action, extraction: candidate.analysis.extraction, confirmedFields: confirmations })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Vorgang fehlgeschlagen.');
      setCandidates(current => current.filter(item => item.id !== candidate.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Vorgang fehlgeschlagen.');
    } finally {
      setBusy('');
    }
  }

  return <main>
    <div className="page-header">
      <div><p className="badge">E-Mail-Prüfung</p><h1>Importe prüfen</h1></div>
      <Link className="button-link button-secondary" href="/vouchers">Zu den Gutscheinen</Link>
    </div>
    <p className="muted">Weitergeleitete E-Mails werden erst nach Prüfung in den aktiven Bestand übernommen.</p>
    {error && <p className="message error-message" role="alert">{error}</p>}

    <section className="list section-gap">
      {candidates.map(candidate => {
        const extraction = candidate.analysis.extraction;
        const confirmations = confirmed[candidate.id] ?? [];
        const pending = candidate.analysis.reviewFlags.filter(flag => !confirmations.includes(flag.field)).length;
        return <article className="card" key={candidate.id}>
          <div className="row wrap-row">
            <div><h2>{candidate.subject || 'E-Mail ohne Betreff'}</h2><div className="muted">Von {candidate.sender} · {formatDateTime(candidate.receivedAt)}</div></div>
            <span className={`status-pill ${pending ? 'status-review' : 'status-ready'}`}>{pending ? `${pending} offen` : 'Speicherbereit'}</span>
          </div>

          <div className="form-grid section-gap-small">
            <Field label="Anbieter"><input value={extraction.merchantName} onChange={event => update(candidate.id, 'merchantName', event.target.value)} /></Field>
            <Field label="Bezeichnung"><input value={extraction.title} onChange={event => update(candidate.id, 'title', event.target.value)} /></Field>
            <Field label="Art"><select value={extraction.kind} onChange={event => update(candidate.id, 'kind', event.target.value as VoucherKind)}>
              <option value="VALUE">Wertgutschein</option><option value="DISCOUNT">Rabatt</option><option value="SERVICE">Leistung</option>
              <option value="CASHBACK">Cashback</option><option value="STORE_CREDIT">Guthaben</option><option value="LOYALTY">Treuevorteil</option>
            </select></Field>
            <Field label="Code"><input value={extraction.code ?? ''} onChange={event => update(candidate.id, 'code', empty(event.target.value))} /></Field>
            <Field label="Wert in Euro"><input inputMode="decimal" value={extraction.valueAmount ?? ''} onChange={event => update(candidate.id, 'valueAmount', number(event.target.value))} /></Field>
            <Field label="Rabatt in Prozent"><input inputMode="decimal" value={extraction.discountPercent ?? ''} onChange={event => update(candidate.id, 'discountPercent', number(event.target.value))} /></Field>
            <Field label="Gültig bis"><input type="date" value={extraction.validUntil?.slice(0, 10) ?? ''} onChange={event => update(candidate.id, 'validUntil', isoDate(event.target.value))} /></Field>
            <Field label="Mindestbestellwert"><input inputMode="decimal" value={extraction.minimumOrderValue ?? ''} onChange={event => update(candidate.id, 'minimumOrderValue', number(event.target.value))} /></Field>
            <div className="full-width"><Field label="Bedingungen"><textarea rows={3} value={extraction.terms ?? ''} onChange={event => update(candidate.id, 'terms', empty(event.target.value))} /></Field></div>
          </div>

          <div className="option-list section-gap-small">
            <label className="check-row"><input type="checkbox" checked={extraction.eventMonitoringEnabled} onChange={event => update(candidate.id, 'eventMonitoringEnabled', event.target.checked)} />Aktionen dieses Anbieters überwachen</label>
          </div>

          {candidate.analysis.reviewFlags.length > 0 && <div className="review-box section-gap-small">
            <h3>Unsichere Angaben bestätigen</h3>
            {candidate.analysis.reviewFlags.map(flag => <label className="check-row" key={flag.field}>
              <input type="checkbox" checked={confirmations.includes(flag.field)} onChange={() => toggleConfirmation(candidate.id, flag.field)} />
              <span><strong>{fieldLabel(flag.field)}</strong><span className="muted block">{flag.reason}</span></span>
            </label>)}
          </div>}

          <div className="candidate-actions section-gap-small">
            <button className="button-quiet" disabled={busy === candidate.id} onClick={() => act(candidate, 'DISMISS')}>Verwerfen</button>
            <button className="primary" disabled={busy === candidate.id || pending > 0 || !extraction.merchantName.trim() || !extraction.title.trim()} onClick={() => act(candidate, 'IMPORT')}>{busy === candidate.id ? 'Speichere…' : 'Als Gutschein übernehmen'}</button>
          </div>
        </article>;
      })}
      {!candidates.length && !error && <div className="card empty-state"><h2>Keine offenen E-Mail-Importe</h2><p className="muted">Neue weitergeleitete Gutscheine erscheinen hier zur Prüfung.</p></div>}
    </section>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label>{label}{children}</label>; }
function empty(value: string) { return value.trim() || undefined; }
function number(value: string) { const parsed = Number(value.replace(',', '.')); return value.trim() && Number.isFinite(parsed) ? parsed : undefined; }
function isoDate(value: string) { return value ? new Date(`${value}T12:00:00.000Z`).toISOString() : undefined; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function fieldLabel(field: string) { return ({ _overall: 'Gesamtergebnis', _source_text: 'Dokumenterkennung', merchantName: 'Anbieter', title: 'Bezeichnung', kind: 'Art', valueAmount: 'Wert', discountPercent: 'Rabatt', validUntil: 'Ablaufdatum', code: 'Code' } as Record<string, string>)[field] ?? field; }
