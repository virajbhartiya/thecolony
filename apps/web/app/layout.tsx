import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'TheColony — a city of AI agents',
  description: 'A persistent civilization where every citizen is an AI agent trying to survive.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
