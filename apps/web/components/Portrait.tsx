'use client';
import { agentLook } from '../lib/sprite-helpers';

export default function Portrait({ seed, size = 64 }: { seed: string; size?: number }) {
  const look = agentLook(seed);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{
        imageRendering: 'pixelated',
        background: '#1c1925',
        border: '1px solid #3a304a',
        display: 'block',
      }}
    >
      <defs>
        <linearGradient id={`pg-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2236" />
          <stop offset="1" stopColor="#0b0a10" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" fill={`url(#pg-${seed})`} />
      <rect x="6" y="22" width="20" height="10" fill={look.shirt} />
      <rect x="7" y="24" width="18" height="1" fill="#0b0a10" opacity="0.4" />
      <rect x="14" y="18" width="4" height="4" fill={look.skin} />
      <rect x="10" y="10" width="12" height="10" fill={look.skin} />
      <rect x="9" y="8" width="14" height="4" fill={look.hair} />
      <rect x="9" y="12" width="2" height="3" fill={look.hair} />
      <rect x="21" y="12" width="2" height="3" fill={look.hair} />
      <rect x="12" y="14" width="2" height="2" fill="#0b0a10" />
      <rect x="18" y="14" width="2" height="2" fill="#0b0a10" />
      <rect x="13" y="18" width="6" height="1" fill="#0b0a10" />
      <rect x="11" y="11" width="1" height="1" fill="#fff" opacity="0.25" />
    </svg>
  );
}
