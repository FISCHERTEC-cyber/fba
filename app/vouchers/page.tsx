'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Voucher = {
  id: string;
  merchantName: string;
  title: string;
  kind: string;
  valueAmount: string | number | null;
  remainingAmount: number | null;
  currency: string | null;
  discountPercent: string | number | null;
  validUntil: string | null;
  physicalVoucher: boolean;
  storageLocation: string | null;
  owned: boolean;
  canRedeem: boolean;
  accessRole: 'OWNER' | 'MEMBER' | 'VIEWER';
  wallet: { id: string; name: string } | null;
};

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/vouchers', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Gutscheine konnten nicht geladen werden.');
      setVouchers(payload.vouchers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gutscheine konnten nicht geladen werden.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function redeem(voucher: Voucher, completely: boolean) {
    setBusyId(voucher.id);
    setError('');
    try {
      const value = amounts[voucher.id]?.replace(',', '.');
      const amount = value ? Number(value) : undefined;
      if (!completely && (!amount || amount <= 0)) throw new Error('Bitte einen gültigen Teilbetrag eingeben.');
      const response = await fetch(`/api/vouchers/${voucher.id}/redemptions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(completely ? { redeemCompletely: true } : { amount })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Einlösung konnte nicht gespeichert werden.');
      setAmounts(current => ({ ...current, [voucher.id]: '' }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Einlösung konnte nicht gespeichert werden.');
    } finally {
      setBusyId('');
    }
  }

  return <main>
    <div className="page-header">
      <div><p className="badge">Bestand</p><h1>Meine Gutscheine</h1></div>
      <Link className="button-link primary" href="/import">Gutschein erfassen</Link>
    </div>
    <p className="muted">Restguthaben erfassen, Teilbeträge abbuchen und physische Originale wiederfinden.</p>
    {error && <p className="message error-message" role="alert">{error}</p>}

    <section className="list section-gap">
      {vouchers.map(voucher => {
        const monetary = voucher.remainingAmount !== null;
        return <article className="card" key={voucher.id}>
          <div className="row wrap-row">
            <div>
              <h2>{voucher.merchantName}: {voucher.title}</h2>
              <div className="muted">Gültig bis {formatDate(voucher.validUntil)}</div>
              {voucher.wallet && <div className="wallet-note">Familien-Wallet: {voucher.wallet.name}{!voucher.owned ? ` · ${voucher.accessRole === 'VIEWER' ? 'nur ansehen' : 'gemeinsam nutzbar'}` : ''}</div>}
              {voucher.physicalVoucher && <div className="storage-note">Original: {voucher.storageLocation || 'Aufbewahrungsort nicht erfasst'}</div>}
            </div>
            <div className="metric">{monetary
              ? formatMoney(voucher.remainingAmount!, voucher.currency)
              : voucher.discountPercent ? `${Number(voucher.discountPercent)} %` : kindLabel(voucher.kind)}</div>
          </div>
          {voucher.canRedeem ? <div className="redemption-row section-gap-small">
            {monetary && <input aria-label={`Teilbetrag für ${voucher.title}`} inputMode="decimal" placeholder="Teilbetrag in EUR" value={amounts[voucher.id] ?? ''} onChange={event => setAmounts(current => ({ ...current, [voucher.id]: event.target.value }))} />}
            {monetary && <button className="button-secondary" disabled={busyId === voucher.id} onClick={() => redeem(voucher, false)}>Teilbetrag abbuchen</button>}
            <button className="primary" disabled={busyId === voucher.id} onClick={() => redeem(voucher, true)}>{busyId === voucher.id ? 'Speichere…' : 'Vollständig eingelöst'}</button>
          </div> : <p className="muted section-gap-small">Dieser Gutschein wurde nur zur Ansicht freigegeben.</p>}
        </article>;
      })}
      {!vouchers.length && !error && <div className="card empty-state"><h2>Keine aktiven Gutscheine</h2><p className="muted">Erfasste Gutscheine erscheinen hier.</p></div>}
    </section>
  </main>;
}

function formatMoney(amount: number, currency: string | null) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(amount);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('de-DE').format(new Date(value)) : 'unbefristet';
}

function kindLabel(kind: string) {
  return ({ SERVICE: 'Leistung', LOYALTY: 'Treuevorteil', DISCOUNT: 'Rabatt' } as Record<string, string>)[kind] ?? kind;
}
