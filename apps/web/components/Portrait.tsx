'use client';
import { useMemo } from 'react';

function hashSeed(s: string): number[] {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  const out: number[] = [];
  let x = h >>> 0;
  for (let i = 0; i < 8; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out.push(x % 256);
  }
  return out;
}

const SKIN = ['#f5d6a0', '#e1b58b', '#c89a76', '#a07a5a', '#6e4e36'];
const HAIR = ['#1b1b1b', '#3a261c', '#5c3a1e', '#806033', '#b07a2a', '#c1c1c1', '#5a4470'];
const SHIRT = ['#7e85e0', '#7ee787', '#e07e9c', '#e0c87e', '#7eafe0', '#b07ee0', '#888'];

export default function Portrait({ seed, size = 64 }: { seed: string; size?: number }) {
  const colors = useMemo(() => {
    const h = hashSeed(seed);
    return {
      skin: SKIN[h[0]! % SKIN.length],
      hair: HAIR[h[1]! % HAIR.length],
      shirt: SHIRT[h[2]! % SHIRT.length],
      eye: h[3]! % 2 === 0 ? '#1b1b1b' : '#3a261c',
      hairStyle: h[4]! % 3, // 0 short, 1 long, 2 buzz
      bg: `hsl(${h[5]! % 360}, 30%, 16%)`,
    };
  }, [seed]);

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="rounded-md">
      <rect width="64" height="64" fill={colors.bg} />
      <ellipse cx="32" cy="58" rx="26" ry="12" fill={colors.shirt} />
      <circle cx="32" cy="30" r="14" fill={colors.skin} />
      {colors.hairStyle === 0 && (
        <path d="M18 28 Q18 14 32 14 Q46 14 46 28 L46 22 Q32 18 18 22 Z" fill={colors.hair} />
      )}
      {colors.hairStyle === 1 && (
        <path d="M16 32 Q16 12 32 12 Q48 12 48 32 L48 24 Q32 16 16 24 Z M16 32 L18 46 L20 36 Z M48 32 L46 46 L44 36 Z" fill={colors.hair} />
      )}
      {colors.hairStyle === 2 && <path d="M20 22 Q32 16 44 22 L44 20 Q32 14 20 20 Z" fill={colors.hair} />}
      <circle cx="27" cy="30" r="1.5" fill={colors.eye} />
      <circle cx="37" cy="30" r="1.5" fill={colors.eye} />
      <path d="M28 36 Q32 38 36 36" stroke="#5c3322" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
