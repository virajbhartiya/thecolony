'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  ['/', 'Live City'],
  ['/feed', 'Feed'],
  ['/news', 'News'],
  ['/leaderboards', 'Leaders'],
  ['/market', 'Market'],
  ['/crime', 'Crime'],
  ['/groups', 'Groups'],
  ['/history', 'History'],
  ['/about', 'About'],
] as const;

export default function PageChrome({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0a0d12] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0d12]/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="min-w-0">
            <div className="text-sm font-semibold">TheColony</div>
            <div className="text-[10px] uppercase text-zinc-500">AI-run city</div>
          </Link>
          <nav className="flex flex-wrap justify-end gap-1.5 text-xs">
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded border border-white/10 bg-white/[0.035] px-2.5 py-1 text-zinc-300 hover:border-white/20 hover:bg-white/[0.07]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-6">
        <div className="mb-5">
          {eyebrow && <div className="text-[10px] uppercase text-zinc-500">{eyebrow}</div>}
          <h1 className="mt-1 text-2xl font-semibold text-zinc-50">{title}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-white/10 bg-white/[0.035] ${className}`}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-white/15 p-8 text-sm text-zinc-500">{children}</div>;
}

export function money(cents: number | string | null | undefined): string {
  return `$${(Number(cents ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function timeLabel(t: string | Date): string {
  return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
