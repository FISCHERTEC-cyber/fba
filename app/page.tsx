import Link from 'next/link';
import { vouchers, opportunities } from '@/lib/demo';

export default function Home() {
  const active = vouchers.filter(v => v.status === 'ACTIVE');
  const total = active.reduce((s,v) => s + (v.valueAmount ?? 0), 0);
  const physical = active.filter(v => v.physicalVoucher).length;
  return <main>
    <p className="badge">MVP 1.0</p>
    <h1>FISCHERTEC Benefit Agent</h1>
    <p className="muted">Vorhandene Gutscheine, Guthaben und Vorteile erkennen, wiederfinden und sinnvoll einsetzen.</p>

    <section className="grid" style={{marginTop:20}}>
      <div className="card"><div className="muted">Aktiver Geldwert</div><div className="metric">{total.toFixed(0)} €</div></div>
      <div className="card"><div className="muted">Aktive Vorteile</div><div className="metric">{active.length}</div></div>
      <div className="card"><div className="muted">Physische Originale</div><div className="metric">{physical}</div></div>
      <div className="card"><div className="muted">Nutzungschancen</div><div className="metric">{opportunities.length}</div></div>
    </section>

    <section className="grid" style={{marginTop:20}}>
      <Link className="card" href="/vouchers"><strong>Gutscheine verwalten</strong><div className="muted">Restguthaben, Teilverbrauch und Aufbewahrungsorte verwalten.</div></Link>
      <Link className="card" href="/import"><strong>Gutschein erfassen</strong><div className="muted">Text analysieren, Felder erkennen und unsichere Werte prüfen.</div></Link>
      <Link className="card" href="/import-candidates"><strong>E-Mail-Importe prüfen</strong><div className="muted">Weitergeleitete Gutscheine bearbeiten, übernehmen oder verwerfen.</div></Link>
      <Link className="card" href="/opportunities"><strong>Nutzungschancen ansehen</strong><div className="muted">Events mit vorhandenen Gutscheinen abgleichen und priorisieren.</div></Link>
      <Link className="card" href="/notifications"><strong>Benachrichtigungen öffnen</strong><div className="muted">Ablauftermine und neue Einlösemöglichkeiten im Blick behalten.</div></Link>
    </section>

    <section style={{marginTop:26}}>
      <h2>Bald sinnvoll verwenden</h2>
      <div className="list">
        {opportunities.map(o => <div className="card" key={o.id}>
          <div className="row"><div><strong>{o.merchantName}: {o.title}</strong><div className="muted">{o.reason.join(' · ')}</div></div><div className="metric">{o.relevanceScore}</div></div>
        </div>)}
      </div>
    </section>

    <section style={{marginTop:26}}>
      <h2>Meine Gutscheine</h2>
      <div className="list">
        {active.map(v => <div className="card" key={v.id}>
          <div className="row"><div><strong>{v.merchantName}</strong><div>{v.title}</div><div className="muted">Gültig bis {v.validUntil ?? 'unbefristet'}</div>{v.storageLocation && <div className="muted">Aufbewahrung: {v.storageLocation}</div>}</div><div>{v.valueAmount ? `${v.valueAmount} ${v.currency}` : v.discountPercent ? `${v.discountPercent} %` : v.kind}</div></div>
        </div>)}
      </div>
    </section>
  </main>;
}
