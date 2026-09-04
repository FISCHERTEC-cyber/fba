'use client';

import { useState } from 'react';

type Analysis = {
  extraction: Record<string, unknown>;
  reviewRequired: boolean;
  reviewFlags: { field: string; confidence: number; reason: string }[];
  provenance: { textProvider: string; textConfidence: number; sourceType: string; fileName?: string };
};

const sample = `Gasthaus Adler\nRestaurant-Gutschein 100 EUR\nGutscheincode: ADLER-2026-100\nGültig bis 30.11.2026\nhttps://example.org/gutschein`;

export default function ImportPage() {
  const [text, setText] = useState(sample);
  const [sourceType, setSourceType] = useState('PHOTO');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function analyse() {
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const response = await fetch('/api/import/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceType, rawText: text, mimeType: 'text/plain' })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Analyse fehlgeschlagen');
      setAnalysis(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyse fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return <main>
    <p className="badge">Import & Prüfen</p>
    <h1>Gutschein erfassen</h1>
    <p className="muted">MVP 0.5: Textimporte sind direkt nutzbar. Fotos, Screenshots und PDF-Dateien werden verarbeitet, sobald ein OCR-Provider konfiguriert ist.</p>

    <section className="card" style={{marginTop:20}}>
      <label>Quelle</label>
      <select value={sourceType} onChange={e => setSourceType(e.target.value)}>
        <option value="PHOTO">Foto</option>
        <option value="PDF">PDF</option>
        <option value="SCREENSHOT">Screenshot</option>
        <option value="EMAIL">E-Mail</option>
        <option value="MANUAL">Manuell</option>
      </select>
      <label style={{display:'block',marginTop:14}}>Erkannter / eingefügter Text</label>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={10} style={{width:'100%'}} />
      <button onClick={analyse} disabled={loading} style={{marginTop:12}}>{loading ? 'Analysiere…' : 'Analysieren'}</button>
      {error && <p>{error}</p>}
    </section>

    {analysis && <section style={{marginTop:24}}>
      <div className="card">
        <h2>Prüfergebnis</h2>
        <p><strong>{analysis.reviewRequired ? 'Nutzerprüfung erforderlich' : 'Automatisch plausibel'}</strong></p>
        <p className="muted">Textquelle: {analysis.provenance.textProvider} · Text-Confidence {Math.round(analysis.provenance.textConfidence * 100)} %</p>
        {analysis.reviewFlags.length > 0 && <ul>{analysis.reviewFlags.map(flag => <li key={`${flag.field}-${flag.reason}`}><strong>{flag.field}</strong>: {flag.reason}</li>)}</ul>}
        <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(analysis.extraction, null, 2)}</pre>
      </div>
    </section>}
  </main>;
}
