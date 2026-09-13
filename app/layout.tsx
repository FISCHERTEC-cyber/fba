import type { ReactNode } from 'react';
import Link from 'next/link';
import { ActionNavLink } from './action-nav-link';
import './styles.css';

export const metadata = {
  title: 'FISCHERTEC Benefit Agent',
  description: 'Gutscheine, Guthaben und Vorteile erkennen, verwalten und sinnvoll einsetzen.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="de"><body><nav className="app-nav"><Link href="/">Dashboard</Link><Link href="/vouchers">Gutscheine</Link><ActionNavLink /><Link href="/notifications">Hinweise</Link><Link href="/import">Erfassen</Link></nav>{children}</body></html>;
}
