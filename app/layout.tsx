import type { ReactNode } from 'react';
import './styles.css';

export const metadata = {
  title: 'FISCHERTEC Benefit Agent',
  description: 'Gutscheine, Guthaben und Vorteile erkennen, verwalten und sinnvoll einsetzen.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="de"><body>{children}</body></html>;
}
