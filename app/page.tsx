'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Voucher = { id: string; merchantName: string; title: string; kind: string; valueAmount: number | null; remainingAmount?: number | null; currency: string | null; discountPercent: number | null; validUntil: string | null; physicalVoucher: boolean; storageLocation: string | null };
type Opportunity = { id: string; merchantName: string; title: string; reason: string[]; relevanceScore: number };

export default function Home() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [voucherResponse, opportunityResponse] = await Promise.all([fetch('/api/vouchers'), fetch('/api/opportunities')]);
        if (!voucherResponse.ok) throw new Error('Gutscheine konnten nicht geladen werden.');
        setVouchers((await voucherResponse.json()).vouchers ?? []);
        if (opportunityResponse.ok) setOpportunities((await opportunityResponse.json()).opportunities ?? []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Dashboard konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    }
    void loadDashboard();
  }, []);

  const total = useMemo(() => vouchers.reduce((sum, voucher) => sum + (voucher.remainingAmount ?? voucher.valueAmount ?? 0), 0), [vouchers]);
  const physical = vouchers.filter(voucher => voucher.physicalVoucher).length;

  return <main>
    <p className="badge">Übersicht</p>
    <h1>FISCHERTEC Benefit Agent</h1>
    <p className="muted">Vorhandene Gutscheine, Guthaben und Vorteile erkennen, wiederfinden und sinnvoll einsetzen.</p>
    <section className="grid" style={{ marginTop: 20 }}>
      <Link className="card" href="/account"><strong>Anmeldung und Konto</strong><div className="muted">Sitzung, Gerätebegrenzung und kontrollierte Übernahme verwalten.</div></Link>
      <div className="card"><div className="muted">Aktiver Geldwert</div><div className="metric">{total.toFixed(2)} €</div></div>
      <div className="card"><div className="muted">Aktive Vorteile</div><div className="metric">{vouchers.length}</div></div>
      <div className="card"><div className="muted">Physische Originale</div><div className="metric">{physical}</div></div>
      <div className="card"><div className="muted">Nutzungschancen</div><div className="metric">{opportunities.length}</div></div>
    </section>
    <section className="grid" style={{ marginTop: 20 }}>
      <Link className="card" href="/vouchers"><strong>Gutscheine verwalten</strong><div className="muted">Restguthaben, Teilverbrauch und Aufbewahrungsorte verwalten.</div></Link>
      <Link className="card" href="/import"><strong>Gutschein erfassen</strong><div className="muted">Text analysieren, Felder erkennen und unsichere Werte prüfen.</div></Link>
      <Link className="card" href="/import-candidates"><strong>E-Mail-Importe prüfen</strong><div className="muted">Weitergeleitete Gutscheine bearbeiten, übernehmen oder verwerfen.</div></Link>
      <Link className="card" href="/opportunities"><strong>Nutzungschancen ansehen</strong><div className="muted">Events mit vorhandenen Gutscheinen abgleichen und priorisieren.</div></Link>
      <Link className="card" href="/notifications"><strong>Benachrichtigungen öffnen</strong><div className="muted">Ablauftermine und neue Einlösemöglichkeiten im Blick behalten.</div></Link>
      <Link className="card" href="/wallet"><strong>Familien-Wallet verwalten</strong><div className="muted">Gutscheine gezielt zum Ansehen oder gemeinsamen Einlösen freigeben.</div></Link>
    </section>
    {error && <p className="message error-message" role="alert">{error}</p>}
    {loading ? <p className="muted" style={{ marginTop: 26 }}>Dashboard wird geladen…</p> : <>
      <section style={{ marginTop: 26 }}><h2>Bald sinnvoll verwenden</h2><div className="list">
        {opportunities.length ? opportunities.map(opportunity => <div className="card" key={opportunity.id}><div className="row"><div><strong>{opportunity.merchantName}: {opportunity.title}</strong><div className="muted">{opportunity.reason.join(' · ')}</div></div><div className="metric">{opportunity.relevanceScore}</div></div></div>) : <p className="muted">Derzeit keine passenden Nutzungschancen.</p>}
      </div></section>
      <section style={{ marginTop: 26 }}><h2>Meine Gutscheine</h2><div className="list">
        {vouchers.length ? vouchers.map(voucher => <div className="card" key={voucher.id}><div className="row"><div><strong>{voucher.merchantName}</strong><div>{voucher.title}</div><div className="muted">Gültig bis {voucher.validUntil ? new Intl.DateTimeFormat('de-DE').format(new Date(voucher.validUntil)) : 'unbefristet'}</div>{voucher.storageLocation && <div className="muted">Aufbewahrung: {voucher.storageLocation}</div>}</div><div>{voucher.remainingAmount ?? voucher.valueAmount ? `${(voucher.remainingAmount ?? voucher.valueAmount)?.toFixed(2)} ${voucher.currency ?? 'EUR'}` : voucher.discountPercent ? `${voucher.discountPercent} %` : voucher.kind}</div></div></div>) : <p className="muted">Noch keine aktiven Gutscheine erfasst.</p>}
      </div></section>
    </>}
  </main>;
}
