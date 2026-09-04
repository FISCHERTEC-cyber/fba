'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Notification = {
  id: string;
  kind: 'EXPIRY' | 'OPPORTUNITY';
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationResponse = {
  notifications: Notification[];
  unreadCount: number;
  error?: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string>();
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const payload = await response.json() as NotificationResponse;
      if (!response.ok) throw new Error(payload.error ?? 'Benachrichtigungen konnten nicht geladen werden.');
      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Benachrichtigungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  async function updateNotification(id: string, action: 'READ' | 'DISMISS') {
    setUpdatingId(id);
    setError('');
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Benachrichtigung konnte nicht aktualisiert werden.');

      setNotifications(current => action === 'DISMISS'
        ? current.filter(notification => notification.id !== id)
        : current.map(notification => notification.id === id
          ? { ...notification, readAt: new Date().toISOString() }
          : notification));
      setUnreadCount(current => {
        const wasUnread = notifications.some(notification => notification.id === id && !notification.readAt);
        return wasUnread ? Math.max(0, current - 1) : current;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Benachrichtigung konnte nicht aktualisiert werden.');
    } finally {
      setUpdatingId(undefined);
    }
  }

  return <main>
    <header className="page-header">
      <div>
        <p className="badge">{unreadCount} ungelesen</p>
        <h1>Benachrichtigungen</h1>
        <p className="muted">Ablauftermine und passende Einlösemöglichkeiten für deine aktiven Gutscheine.</p>
      </div>
      <Link className="header-action" href="/">Zur Übersicht</Link>
    </header>

    {error && <p className="message error-message section-gap" role="alert">{error}</p>}

    {loading ? <section className="card empty-state section-gap" aria-live="polite">
      <h2>Benachrichtigungen werden geladen …</h2>
    </section> : notifications.length === 0 ? <section className="card empty-state section-gap">
      <h2>Alles erledigt</h2>
      <p className="muted">Aktuell gibt es keine offenen Benachrichtigungen.</p>
    </section> : <section className="notification-list" aria-label="Benachrichtigungsliste">
      {notifications.map(notification => {
        const unread = !notification.readAt;
        return <article className={`card notification-card ${unread ? 'notification-card-unread' : ''}`} key={notification.id}>
          <span className={`notification-marker ${unread ? '' : 'notification-marker-read'}`} aria-label={unread ? 'Ungelesen' : 'Gelesen'} />
          <div className="notification-content">
            <h2>{notification.title}</h2>
            <p>{notification.body}</p>
            <div className="notification-meta">
              <span>{notification.kind === 'EXPIRY' ? 'Ablauferinnerung' : 'Nutzungschance'}</span>
              <span>{formatTimestamp(notification.createdAt)}</span>
            </div>
          </div>
          <div className="notification-actions">
            {unread && <button
              className="button-secondary"
              disabled={updatingId === notification.id}
              onClick={() => updateNotification(notification.id, 'READ')}
            >Als gelesen markieren</button>}
            <button
              className="button-quiet"
              disabled={updatingId === notification.id}
              onClick={() => updateNotification(notification.id, 'DISMISS')}
            >Ausblenden</button>
          </div>
        </article>;
      })}
    </section>}
  </main>;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
