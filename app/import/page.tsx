'use client';

import { useState } from 'react';

type SourceType = 'PHOTO' | 'PDF' | 'SCREENSHOT' | 'EMAIL' | 'MANUAL';
type VoucherKind = 'VALUE' | 'DISCOUNT' | 'SERVICE' | 'CASHBACK' | 'STORE_CREDIT' | 'LOYALTY';

type Extraction = {
  merchantName: string;
  title: string;
  kind: VoucherKind;
  valueAmount?: number;
  currency: string;
  discountPercent?: number;
  code?: string;
  validUntil?: string;
  minimumOrderValue?: number;
  redemptionUrl?: string;
  terms?: string;
  physicalVoucher: boolean;
  storageLocation?: string;
  eventMonitoringEnabled: boolean;
  sourceType: SourceType;
  sourceReference?: string;
  confidence: { overall: number; fields: Record<string, number> };
};

type ReviewFlag = { field: string; confidence: number; reason: string };
type Analysis = {
  extraction: Extraction;
  reviewRequired: boolean;
  reviewFlags: ReviewFlag[];
  provenance: { textProvider: string; textConfidence: number; sourceType: string; fileName?: string };
};

const sample = `Gasthaus Adler\nRestaurant-Gutschein 100 EUR\nGutscheincode: ADLER-2026-100\nGültig bis 30.11.2026\nhttps://example.org/gutschein`;

export default function ImportPage() {
  const [text, setText] = useState(sample);
  const [sourceType, setSourceType] = useState<SourceType>('MANUAL');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [confirmedFields, setConfirmedFields] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function analyse() {
    setLoading(true);
    setError('');
    setSuccess('');
    setAnalysis(null);
    setConfirmedFields([]);
    try {
      const fileData = file ? await fileToBase64(file) : undefined;
      const response = await fetch('/api/import/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          ...(file
            ? { fileName: file.name, mimeType: file.type, base64Data: fileData, sourceReference: file.name }
            : { rawText: text, mimeType: 'text/plain' })
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Analyse fehlgeschlagen');
      setAnalysis(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analyse fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  async function saveVoucher() {
    if (!analysis) return;
    const unconfirmed = analysis.reviewFlags.filter(flag => !confirmedFields.includes(flag.field));
    if (unconfirmed.length) {
      setError(`${unconfirmed.length} unsichere Angabe(n) müssen noch bestätigt werden.`);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ extraction: analysis.extraction, confirmedFields })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Speichern fehlgeschlagen');
      setSuccess(`${payload.voucher.merchantName}: „${payload.voucher.title}“ wurde gespeichert.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  function updateExtraction<K extends keyof Extraction>(field: K, value: Extraction[K]) {
    setAnalysis(current => current ? {
      ...current,
      extraction: { ...current.extraction, [field]: value }
    } : current);
    confirmField(field);
    setSuccess('');
  }

  function confirmField(field: string) {
    setConfirmedFields(current => current.includes(field) ? current : [...current, field]);
  }

  function toggleConfirmation(field: string) {
    setConfirmedFields(current => current.includes(field)
      ? current.filter(item => item !== field)
      : [...current, field]);
  }

  function handleFile(nextFile: File | null) {
    setFile(nextFile);
    setAnalysis(null);
    setSuccess('');
    if (!nextFile) return;
    if (nextFile.type === 'application/pdf') setSourceType('PDF');
    else if (sourceType !== 'SCREENSHOT') setSourceType('PHOTO');
  }

  const pendingFlags = analysis?.reviewFlags.filter(flag => !confirmedFields.includes(flag.field)).length ?? 0;

  return <main>
    <p className="badge">Import & Prüfen</p>
    <h1>Gutschein erfassen</h1>
    <p className="muted">Text kann direkt analysiert werden. Fotos, Screenshots und PDF-Dateien benötigen einen konfigurierten OCR-Provider.</p>

    <section className="card section-gap">
      <div className="form-grid">
        <div>
          <label htmlFor="source-type">Quelle</label>
          <select id="source-type" value={sourceType} onChange={event => setSourceType(event.target.value as SourceType)}>
            <option value="MANUAL">Text / manuell</option>
            <option value="PHOTO">Foto eines Gutscheins</option>
            <option value="SCREENSHOT">Screenshot</option>
            <option value="PDF">PDF</option>
            <option value="EMAIL">E-Mail-Text</option>
          </select>
        </div>
        <div>
          <label htmlFor="voucher-file">Datei (optional)</label>
          <input id="voucher-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => handleFile(event.target.files?.[0] ?? null)} />
        </div>
      </div>

      {!file && <>
        <label htmlFor="voucher-text">Gutscheintext</label>
        <textarea id="voucher-text" value={text} onChange={event => setText(event.target.value)} rows={9} />
      </>}
      {file && <p className="file-note"><strong>{file.name}</strong> · {formatFileSize(file.size)}</p>}

      <button className="primary" onClick={analyse} disabled={loading || (!file && !text.trim())}>
        {loading ? 'Analysiere…' : 'Analysieren'}
      </button>
      {error && <p className="message error-message" role="alert">{error}</p>}
      {success && <p className="message success-message" role="status">{success}</p>}
    </section>

    {analysis && <section className="section-gap">
      <div className="card">
        <div className="row wrap-row">
          <div>
            <h2>Erkannte Angaben prüfen</h2>
            <p className="muted">Textquelle: {analysis.provenance.textProvider} · Erkennungsqualität {Math.round(analysis.provenance.textConfidence * 100)} %</p>
          </div>
          <span className={`status-pill ${pendingFlags ? 'status-review' : 'status-ready'}`}>
            {pendingFlags ? `${pendingFlags} Bestätigung(en) offen` : 'Speicherbereit'}
          </span>
        </div>

        <div className="form-grid section-gap-small">
          <div>
            <label htmlFor="merchant-name">Anbieter</label>
            <input id="merchant-name" value={analysis.extraction.merchantName} onChange={event => updateExtraction('merchantName', event.target.value)} />
          </div>
          <div>
            <label htmlFor="voucher-title">Bezeichnung</label>
            <input id="voucher-title" value={analysis.extraction.title} onChange={event => updateExtraction('title', event.target.value)} />
          </div>
          <div>
            <label htmlFor="voucher-kind">Art</label>
            <select id="voucher-kind" value={analysis.extraction.kind} onChange={event => updateExtraction('kind', event.target.value as VoucherKind)}>
              <option value="VALUE">Wertgutschein</option>
              <option value="DISCOUNT">Rabatt</option>
              <option value="SERVICE">Leistung</option>
              <option value="CASHBACK">Cashback</option>
              <option value="STORE_CREDIT">Guthaben</option>
              <option value="LOYALTY">Treuevorteil</option>
            </select>
          </div>
          <div>
            <label htmlFor="voucher-code">Code</label>
            <input id="voucher-code" value={analysis.extraction.code ?? ''} onChange={event => updateExtraction('code', emptyToUndefined(event.target.value))} />
          </div>
          <div>
            <label htmlFor="voucher-value">Wert in Euro</label>
            <input id="voucher-value" inputMode="decimal" value={analysis.extraction.valueAmount ?? ''} onChange={event => updateExtraction('valueAmount', parseOptionalNumber(event.target.value))} />
          </div>
          <div>
            <label htmlFor="discount-percent">Rabatt in Prozent</label>
            <input id="discount-percent" inputMode="decimal" value={analysis.extraction.discountPercent ?? ''} onChange={event => updateExtraction('discountPercent', parseOptionalNumber(event.target.value))} />
          </div>
          <div>
            <label htmlFor="minimum-order">Mindestbestellwert in Euro</label>
            <input id="minimum-order" inputMode="decimal" value={analysis.extraction.minimumOrderValue ?? ''} onChange={event => updateExtraction('minimumOrderValue', parseOptionalNumber(event.target.value))} />
          </div>
          <div>
            <label htmlFor="valid-until">Gültig bis</label>
            <input id="valid-until" type="date" value={dateInputValue(analysis.extraction.validUntil)} onChange={event => updateExtraction('validUntil', dateToIso(event.target.value))} />
          </div>
          <div className="full-width">
            <label htmlFor="redemption-url">Einlöse-Link</label>
            <input id="redemption-url" type="url" value={analysis.extraction.redemptionUrl ?? ''} onChange={event => updateExtraction('redemptionUrl', emptyToUndefined(event.target.value))} />
          </div>
          <div className="full-width">
            <label htmlFor="terms">Bedingungen</label>
            <textarea id="terms" rows={4} value={analysis.extraction.terms ?? ''} onChange={event => updateExtraction('terms', emptyToUndefined(event.target.value))} />
          </div>
        </div>

        <div className="option-list section-gap-small">
          <label className="check-row">
            <input type="checkbox" checked={analysis.extraction.physicalVoucher} onChange={event => updateExtraction('physicalVoucher', event.target.checked)} />
            Physischer Gutschein vorhanden
          </label>
          {analysis.extraction.physicalVoucher && <div>
            <label htmlFor="storage-location">Aufbewahrungsort des Originals</label>
            <input id="storage-location" placeholder="z. B. Auto → Handschuhfach → Dokumententasche" value={analysis.extraction.storageLocation ?? ''} onChange={event => updateExtraction('storageLocation', emptyToUndefined(event.target.value))} />
          </div>}
          <label className="check-row">
            <input type="checkbox" checked={analysis.extraction.eventMonitoringEnabled} onChange={event => updateExtraction('eventMonitoringEnabled', event.target.checked)} />
            Passende Aktionen und Veranstaltungen dieses Anbieters überwachen
          </label>
        </div>

        {analysis.reviewFlags.length > 0 && <div className="review-box section-gap-small">
          <h3>Unsichere Angaben bestätigen</h3>
          {analysis.reviewFlags.map(flag => <label className="check-row" key={`${flag.field}-${flag.reason}`}>
            <input type="checkbox" checked={confirmedFields.includes(flag.field)} onChange={() => toggleConfirmation(flag.field)} />
            <span><strong>{fieldLabel(flag.field)}</strong><span className="muted block">{flag.reason}</span></span>
          </label>)}
        </div>}

        <button className="primary section-gap-small" onClick={saveVoucher} disabled={saving || Boolean(success) || pendingFlags > 0 || !analysis.extraction.merchantName.trim() || !analysis.extraction.title.trim()}>
          {success ? 'Gespeichert' : saving ? 'Speichere…' : 'Geprüften Gutschein speichern'}
        </button>
      </div>
    </section>}
  </main>;
}

async function fileToBase64(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Datei ist zu groß. Maximal 10 MiB sind zulässig.');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function emptyToUndefined(value: string) {
  return value.trim() || undefined;
}

function dateInputValue(value?: string) {
  return value?.slice(0, 10) ?? '';
}

function dateToIso(value: string) {
  return value ? new Date(`${value}T12:00:00.000Z`).toISOString() : undefined;
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    _overall: 'Gesamtergebnis',
    _source_text: 'Dokumenterkennung',
    merchantName: 'Anbieter',
    title: 'Bezeichnung',
    kind: 'Art',
    valueAmount: 'Wert',
    discountPercent: 'Rabatt',
    validUntil: 'Ablaufdatum',
    code: 'Code',
    redemptionUrl: 'Einlöse-Link',
    storageLocation: 'Aufbewahrungsort'
  };
  return labels[field] ?? field;
}
