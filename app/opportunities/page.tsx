import { vouchers } from '@/lib/demo';
import { buildOpportunities, type MerchantEvent } from '@/lib/opportunity-engine';

const events: MerchantEvent[] = [
  {
    id: 'evt-wild-2026', merchantName: 'Gasthaus Adler', title: 'Wildwochen',
    startsAt: '2026-10-10T00:00:00Z', endsAt: '2026-10-25T23:59:59Z',
    sourceUrl: 'https://example.org/wildwochen', sourceLabel: 'Website', distanceKm: 18,
    categories: ['Wild', 'Saisonküche'], detectedAt: '2026-09-04T18:00:00Z'
  },
  {
    id: 'evt-music-2026', merchantName: 'Gasthaus Adler', title: 'Musikabend',
    startsAt: '2026-11-20T18:00:00Z', sourceUrl: 'https://example.org/musikabend',
    sourceLabel: 'Website', distanceKm: 18, categories: ['Musik'], detectedAt: '2026-09-04T18:00:00Z'
  }
];

export default function OpportunitiesPage() {
  const results = buildOpportunities(vouchers, events, {
    now: '2026-09-04T18:00:00+02:00',
    preferredCategories: ['Wild', 'Saisonküche'],
    maxDistanceKm: 50
  });

  return <main>
    <p className="badge">Opportunity Engine</p>
    <h1>Passende Einlösemöglichkeiten</h1>
    <p className="muted">Events werden nur mit aktiven Gutscheinen desselben Anbieters verknüpft und anschließend nach Ablaufnähe, Wert, Entfernung und Interessen bewertet.</p>
    <section className="list" style={{marginTop:20}}>
      {results.map(item => <article className="card" key={item.id}>
        <div className="row">
          <div>
            <strong>{item.merchantName}: {item.title}</strong>
            <div className="muted">{item.reason.join(' · ')}</div>
            {item.startsAt && <div className="muted">Termin: {new Date(item.startsAt).toLocaleDateString('de-DE')}</div>}
            {item.sourceUrl && <div><a href={item.sourceUrl}>Quelle öffnen</a></div>}
          </div>
          <div className="metric">{item.relevanceScore}</div>
        </div>
      </article>)}
    </section>
  </main>;
}
