'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function ActionNavLink() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    void fetch('/api/actions', { cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<{ badgeCount?: number }> : null)
      .then(payload => { if (active) setCount(payload?.badgeCount ?? 0); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return <Link href="/actions">Aufgaben{count > 0 && <span className="nav-badge" aria-label={`${count} offene Aufgaben`}>{count}</span>}</Link>;
}
