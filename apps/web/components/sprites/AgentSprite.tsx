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
  variant?: 'adult' | 'child' | 'officer';
  onClick?: () => void;
  onHover?: (h: boolean) => void;
}

// ~2× the previous size so people are visible at any reasonable zoom.
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
  variant = 'adult',
  onClick,
  onHover,
}: Props) {
  const bob = walking ? Math.sin(performance.now() / 110 + (id.charCodeAt(1) || 0)) * 1.4 : 0;
  const yy = y + bob;
  const isChild = variant === 'child';
  const isOfficer = variant === 'officer';
  // Children render at ~70% scale so the city instantly reads "kid".
  // Officers use a uniform-blue shirt + navy pants regardless of agentLook,
  // plus a yellow badge on the chest. They keep their own skin/hair so each
  // officer is still personally recognisable.
  const scale = isChild ? 0.72 : 1;
  const shirt = isOfficer ? '#2e4a8e' : look.shirt;
  const pants = isOfficer ? '#13223a' : look.pants;

  // outlines stroke=0.7 instead of 0.5 so the bigger sprite stays crisp
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      transform={isChild ? `translate(${x}, ${y}) scale(${scale}) translate(${-x}, ${-y})` : undefined}
    >
      {/* shadow */}
      <ellipse cx={x} cy={y + 2} rx={9} ry={3} fill="#000" opacity={0.5} />

      {/* legs */}
      <rect x={x - 5} y={yy - 10} width={4} height={10} fill={pants} stroke="#0b0a10" strokeWidth={0.7} />
      <rect x={x + 1} y={yy - 10} width={4} height={10} fill={pants} stroke="#0b0a10" strokeWidth={0.7} />

      {/* shoes */}
      <rect x={x - 5} y={yy} width={4} height={2} fill="#1c1925" />
      <rect x={x + 1} y={yy} width={4} height={2} fill="#1c1925" />

      {/* torso */}
      <rect x={x - 6} y={yy - 20} width={12} height={11} fill={shirt} stroke="#0b0a10" strokeWidth={0.8} />
      {/* shirt collar / belt accent */}
      <rect x={x - 6} y={yy - 11} width={12} height={1.5} fill="#000" opacity={0.35} />
      {/* officer badge — bright yellow pip on the chest */}
      {isOfficer && (
        <>
          <rect x={x - 1.5} y={yy - 17} width={3} height={3} fill="#f5c842" stroke="#0b0a10" strokeWidth={0.5} />
          <rect x={x - 0.5} y={yy - 16} width={1} height={1} fill="#0b0a10" />
        </>
      )}
      {/* arms (suggested) */}
      <rect x={x - 8} y={yy - 18} width={2} height={8} fill={shirt} stroke="#0b0a10" strokeWidth={0.6} />
      <rect x={x + 6} y={yy - 18} width={2} height={8} fill={shirt} stroke="#0b0a10" strokeWidth={0.6} />

      {/* head */}
      <rect x={x - 4} y={yy - 29} width={8} height={9} fill={look.skin} stroke="#0b0a10" strokeWidth={0.8} />
      {/* hair */}
      <rect x={x - 4} y={yy - 31} width={8} height={4} fill={look.hair} />
      <rect x={x - 5} y={yy - 28} width={1} height={3} fill={look.hair} />
      <rect x={x + 4} y={yy - 28} width={1} height={3} fill={look.hair} />

      {/* officer cap */}
      {isOfficer && (
        <>
          <rect x={x - 5} y={yy - 33} width={10} height={3} fill="#13223a" stroke="#0b0a10" strokeWidth={0.6} />
          <rect x={x - 1.5} y={yy - 32} width={3} height={1.5} fill="#f5c842" />
        </>
      )}

      {/* eyes */}
      <rect x={x - 2} y={yy - 25} width={1.5} height={1.5} fill="#0b0a10" />
      <rect x={x + 1} y={yy - 25} width={1.5} height={1.5} fill="#0b0a10" />
      {/* mouth */}
      <rect x={x - 1} y={yy - 22} width={3} height={1} fill="#5c3322" />

      {/* heat marker — bigger so it pops */}
      {heat?.color && (
        <circle cx={x} cy={yy - 36} r={3.5} fill={heat.color} opacity={heat.alpha ?? 0.95} stroke="#0b0a10" strokeWidth={0.6} />
      )}
      {/* warrant badge */}
      {wanted && (
        <g>
          <rect x={x + 7} y={yy - 35} width={8} height={8} fill="#e2536e" stroke="#0b0a10" strokeWidth={0.7} />
          <rect x={x + 10} y={yy - 33} width={2} height={3} fill="#fff" />
          <rect x={x + 10} y={yy - 29} width={2} height={1.5} fill="#fff" />
        </g>
      )}

      {/* selection / hover ring */}
      {(selected || hovered) && (
        <circle
          cx={x}
          cy={yy - 14}
          r={18}
          fill="none"
          stroke={selected ? '#ffc26b' : '#f0a347'}
          strokeWidth={1.8}
          strokeDasharray={selected ? '0' : '3 2'}
        />
      )}
    </g>
  );
}
