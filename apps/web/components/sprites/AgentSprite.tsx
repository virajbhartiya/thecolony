'use client';
import type { AgentLook } from '../../lib/sprite-helpers';

interface Props {
  id: string;
  x: number;
  y: number;
  look: AgentLook;
  walking?: boolean;
  selected?: boolean;
  hovered?: boolean;
  wanted?: boolean;
  heat?: { color: string; alpha: number } | null;
  onClick?: () => void;
  onHover?: (h: boolean) => void;
}

export default function AgentSprite({
  id,
  x,
  y,
  look,
  walking,
  selected,
  hovered,
  wanted,
  heat,
  onClick,
  onHover,
}: Props) {
  const bob = walking ? Math.sin(performance.now() / 110 + (id.charCodeAt(1) || 0)) * 1 : 0;
  const yy = y + bob;

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <ellipse cx={x} cy={y + 1} rx={6} ry={2} fill="#000" opacity={0.45} />
      <rect x={x - 3} y={yy - 6} width={2} height={6} fill={look.pants} />
      <rect x={x + 1} y={yy - 6} width={2} height={6} fill={look.pants} />
      <rect x={x - 3} y={yy - 12} width={6} height={6} fill={look.shirt} stroke="#0b0a10" strokeWidth={0.5} />
      <rect x={x - 2} y={yy - 16} width={4} height={4} fill={look.skin} stroke="#0b0a10" strokeWidth={0.5} />
      <rect x={x - 2} y={yy - 17} width={4} height={2} fill={look.hair} />
      <rect x={x - 1} y={yy - 15} width={1} height={1} fill="#0b0a10" />
      <rect x={x + 1} y={yy - 15} width={1} height={1} fill="#0b0a10" />

      {heat?.color && (
        <circle cx={x} cy={yy - 20} r={2.5} fill={heat.color} opacity={heat.alpha ?? 0.9} />
      )}
      {wanted && (
        <g>
          <rect x={x + 5} y={yy - 20} width={6} height={6} fill="#e2536e" stroke="#0b0a10" />
          <rect x={x + 7} y={yy - 19} width={2} height={2} fill="#fff" />
          <rect x={x + 7} y={yy - 16} width={2} height={1} fill="#fff" />
        </g>
      )}

      {(selected || hovered) && (
        <circle
          cx={x}
          cy={yy - 8}
          r={12}
          fill="none"
          stroke={selected ? '#ffc26b' : '#f0a347'}
          strokeWidth={1.5}
          strokeDasharray={selected ? '0' : '2 2'}
        />
      )}
    </g>
  );
}
