'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type WalletRole = 'OWNER' | 'MEMBER' | 'VIEWER';
type Wallet = {
  id: string;
  name: string;
  role: WalletRole;
  voucherCount: number;
  members: Array<{ userId: string; email: string; role: WalletRole; joinedAt: string }>;
  pendingInvitations: Array<{ id: string; email: string; role: WalletRole; expiresAt: string }>;
};
type Voucher = {
  id: string;
  merchantName: string;
  title: string;
  owned: boolean;
  walletId: string | null;
  wallet: { id: string; name: string } | null;
};

export default function FamilyWalletPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [walletName, setWalletName] = useState('Familie');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'VIEWER'>('MEMBER');
  const [invitationToken, setInvitationToken] = useState('');
  const [newInviteLink, setNewInviteLink] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [walletResponse, voucherResponse] = await Promise.all([
        fetch('/api/wallets', { cache: 'no-store' }),
        fetch('/api/vouchers', { cache: 'no-store' })
      ]);
      const walletPayload = await walletResponse.json();
      const voucherPayload = await voucherResponse.json();
      if (!walletResponse.ok) throw new Error(walletPayload.error ?? 'Wallets konnten nicht geladen werden.');
      if (!voucherResponse.ok) throw new Error(voucherPayload.error ?? 'Gutscheine konnten nicht geladen werden.');
      setWallets(walletPayload.wallets);
      setVouchers(voucherPayload.vouchers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Familien-Wallet konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setInvitationToken(hash.get('invite') ?? '');
    void load();
  }, [load]);

  async function createWallet() {
    await mutate('create', '/api/wallets', 'POST', { name: walletName }, 'Wallet wurde angelegt.');
  }

  async function invite(walletId: string) {
    setBusy(`invite-${walletId}`); setError(''); setMessage(''); setNewInviteLink('');
    try {
      const response = await fetch(`/api/wallets/${walletId}/invitations`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Einladung konnte nicht erstellt werden.');
      setNewInviteLink(`${window.location.origin}/wallet#invite=${payload.invitation.token}`);
      setInviteEmail('');
      setMessage('Einladungslink wurde erstellt und ist sieben Tage gültig.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Einladung konnte nicht erstellt werden.');
    } finally { setBusy(''); }
  }

  async function acceptInvitation() {
    const accepted = await mutate('accept', '/api/wallets/invitations/accept', 'POST', { token: invitationToken }, 'Einladung wurde angenommen.');
    if (accepted) {
      window.history.replaceState(null, '', '/wallet');
      setInvitationToken('');
    }
  }

  async function assignVoucher(walletId: string) {
    const voucherId = selectedVoucher[walletId];
    if (!voucherId) return;
    await mutate(`assign-${walletId}`, `/api/wallets/${walletId}/vouchers`, 'POST', { voucherId }, 'Gutschein wurde freigegeben.');
  }

  async function removeVoucher(walletId: string, voucherId: string) {
    await mutate(`voucher-${voucherId}`, `/api/wallets/${walletId}/vouchers`, 'DELETE', { voucherId }, 'Freigabe wurde aufgehoben.');
  }

  async function removeMember(walletId: string, userId: string) {
    await mutate(`member-${userId}`, `/api/wallets/${walletId}/members`, 'DELETE', { userId }, 'Mitglied wurde entfernt.');
  }

  async function revokeInvitation(walletId: string, invitationId: string) {
    await mutate(`invitation-${invitationId}`, `/api/wallets/${walletId}/invitations`, 'DELETE', { invitationId }, 'Einladung wurde widerrufen.');
  }

  async function mutate(key: string, url: string, method: string, body: unknown, success: string) {
    setBusy(key); setError(''); setMessage('');
    try {
      const response = await fetch(url, {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Vorgang fehlgeschlagen.');
      setMessage(success);
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Vorgang fehlgeschlagen.');
      return false;
    } finally { setBusy(''); }
  }

  const ownedVouchers = vouchers.filter(voucher => voucher.owned);

  return <main>
    <header className="page-header">
      <div><p className="badge">Gemeinsam nutzen</p><h1>Familien-Wallet</h1></div>
      <Link href="/">Zur Übersicht</Link>
    </header>
    <p className="muted">Gutscheine bleiben dem ursprünglichen Eigentümer zugeordnet. Die Wallet gibt anderen Personen definierte Nutzungsrechte.</p>
    {error && <p className="message error-message" role="alert">{error} {error === 'Anmeldung erforderlich.' && <Link href="/account">Jetzt anmelden</Link>}</p>}
    {message && <p className="message success-message" role="status">{message}</p>}

    {invitationToken && <section className="card section-gap invitation-box">
      <div><h2>Einladung annehmen</h2><p className="muted">Die Anmeldung muss dieselbe E-Mail-Adresse verwenden, an die eingeladen wurde.</p></div>
      <button className="primary" disabled={busy === 'accept'} onClick={acceptInvitation}>Einladung annehmen</button>
    </section>}

    <section className="card section-gap wallet-create-row">
      <label htmlFor="wallet-name">Neue Wallet<input id="wallet-name" value={walletName} maxLength={80} onChange={event => setWalletName(event.target.value)} /></label>
      <button className="primary" disabled={busy === 'create' || walletName.trim().length < 2} onClick={createWallet}>Wallet anlegen</button>
    </section>

    <section className="list section-gap">
      {wallets.map(wallet => {
        const walletVouchers = vouchers.filter(voucher => voucher.walletId === wallet.id);
        return <article className="card" key={wallet.id}>
          <div className="row wrap-row">
            <div><h2>{wallet.name}</h2><p className="muted">Rolle: {roleLabel(wallet.role)} · {wallet.voucherCount} Gutschein(e)</p></div>
            <span className="status-pill status-ready">{wallet.members.length} Mitglied(er)</span>
          </div>

          <h3>Mitglieder</h3>
          <div className="wallet-member-list">{wallet.members.map(member => <div className="device-row" key={member.userId}>
            <div><strong>{member.email}</strong><span className="muted block">{roleLabel(member.role)}</span></div>
            {wallet.role === 'OWNER' && member.role !== 'OWNER' && <button className="button-quiet" disabled={busy === `member-${member.userId}`} onClick={() => removeMember(wallet.id, member.userId)}>Entfernen</button>}
          </div>)}</div>

          {(wallet.role === 'OWNER' || wallet.role === 'MEMBER') && <div className="wallet-admin-grid section-gap-small">
            {wallet.role === 'OWNER' && <div>
              <h3>Person einladen</h3>
              <label>E-Mail-Adresse<input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} /></label>
              <label>Recht<select value={inviteRole} onChange={event => setInviteRole(event.target.value as 'MEMBER' | 'VIEWER')}><option value="MEMBER">Ansehen und einlösen</option><option value="VIEWER">Nur ansehen</option></select></label>
              <button className="button-secondary" disabled={busy === `invite-${wallet.id}` || !inviteEmail.includes('@')} onClick={() => invite(wallet.id)}>Einladungslink erstellen</button>
              {wallet.pendingInvitations.map(invitation => <div className="pending-invitation" key={invitation.id}>
                <span className="muted">Offen: {invitation.email} ({roleLabel(invitation.role)}) bis {formatDate(invitation.expiresAt)}</span>
                <button className="button-quiet" disabled={busy === `invitation-${invitation.id}`} onClick={() => revokeInvitation(wallet.id, invitation.id)}>Widerrufen</button>
              </div>)}
            </div>}
            <div>
              <h3>Eigenen Gutschein freigeben</h3>
              <label>Gutschein<select value={selectedVoucher[wallet.id] ?? ''} onChange={event => setSelectedVoucher(current => ({ ...current, [wallet.id]: event.target.value }))}><option value="">Bitte auswählen</option>{ownedVouchers.map(voucher => <option value={voucher.id} key={voucher.id}>{voucher.merchantName}: {voucher.title}</option>)}</select></label>
              <button className="button-secondary" disabled={!selectedVoucher[wallet.id] || busy === `assign-${wallet.id}`} onClick={() => assignVoucher(wallet.id)}>Freigeben</button>
            </div>
          </div>}

          <h3 className="section-gap-small">Freigegebene Gutscheine</h3>
          {walletVouchers.length ? <div className="wallet-voucher-list">{walletVouchers.map(voucher => <div className="device-row" key={voucher.id}>
            <div><strong>{voucher.merchantName}</strong><span className="block">{voucher.title}</span></div>
            {((wallet.role === 'OWNER') || voucher.owned) && <button className="button-quiet" disabled={busy === `voucher-${voucher.id}`} onClick={() => removeVoucher(wallet.id, voucher.id)}>Freigabe aufheben</button>}
          </div>)}</div> : <p className="muted">Noch keine Gutscheine freigegeben.</p>}
        </article>;
      })}
      {!wallets.length && !error && <div className="card empty-state"><h2>Noch keine Familien-Wallet</h2><p className="muted">Lege eine Wallet an oder öffne einen Einladungslink.</p></div>}
    </section>

    {newInviteLink && <section className="card section-gap">
      <h2>Einladungslink</h2><p className="muted">Diesen Link nur an die eingeladene Person senden.</p>
      <textarea readOnly rows={3} value={newInviteLink} onFocus={event => event.currentTarget.select()} />
    </section>}
  </main>;
}

function roleLabel(role: WalletRole) {
  return ({ OWNER: 'Eigentümer', MEMBER: 'Ansehen und einlösen', VIEWER: 'Nur ansehen' } as Record<WalletRole, string>)[role];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(value));
}
