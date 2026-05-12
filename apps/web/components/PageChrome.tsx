'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV: Array<[string, string]> = [
  ['/', 'Live'],
  ['/feed', 'Feed'],
  ['/news', 'News'],
  ['/leaderboards', 'Leaders'],
  ['/companies', 'Companies'],
  ['/market', 'Market'],
  ['/crime', 'Crime'],
  ['/groups', 'Groups'],
  ['/history', 'History'],
  ['/about', 'About'],
];

export default function PageChrome({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 0%, #181326 0%, #0b0a10 60%)',
        color: 'var(--cream)',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      <header
        className="panel"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'center',
          gap: 16,
          padding: '10px 18px',
          borderRadius: 0,
          borderLeft: 0,
          borderRight: 0,
          borderTop: 0,
        }}
      >
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', minWidth: 0 }}
        >
          <svg width={28} height={28} viewBox="0 0 28 28">
            <rect x={2} y={14} width={24} height={12} fill="#1c1925" stroke="#f0a347" strokeWidth={1.5} />
            <rect x={6} y={6} width={6} height={20} fill="#f0a347" />
            <rect x={14} y={2} width={6} height={24} fill="#ffc26b" />
            <rect x={22} y={10} width={4} height={16} fill="#4ec5b8" />
            <rect x={0} y={26} width={28} height={2} fill="#0b0a10" />
          </svg>
          <div>
            <div className="pixel" style={{ fontSize: 14, color: '#ffc26b', letterSpacing: '0.16em' }}>
              THECOLONY
            </div>
            <div className="mono" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
              SUB-VIEW
            </div>
          </div>
        </Link>
        <nav style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
          {NAV.map(([href, label]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`chip ${active ? 'active' : ''}`}
                style={{ textDecoration: 'none' }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 18px 48px' }}>
        <div style={{ marginBottom: 20 }}>
          {eyebrow && (
            <div
              className="pixel"
              style={{ fontSize: 10, color: '#8a8478', letterSpacing: '0.18em', textTransform: 'uppercase' }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className="pixel"
            style={{
              marginTop: 6,
              fontSize: 26,
              color: '#ffc26b',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 400,
            }}
          >
            {title}
          </h1>
        </div>
        {children}
      </section>
    </main>
  );
}

export function Panel({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`panel ${className}`} style={style}>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px dashed var(--line)',
        padding: '36px 24px',
        textAlign: 'center',
        color: 'var(--mute)',
        fontSize: 13,
        background: 'rgba(28,25,37,0.4)',
      }}
    >
      {children}
    </div>
  );
}

export function money(cents: number | string | null | undefined): string {
  const v = Number(cents ?? 0) / 100;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function timeLabel(t: string | Date): string {
  return new Date(t).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
