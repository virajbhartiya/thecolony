import { TILE_W, TILE_H, tileToWorld } from '../../lib/iso';

interface Props {
  tx: number;
  ty: number;
  fill: string;
  stroke?: string;
}

export default function TileDiamond({ tx, ty, fill, stroke = '#1a1820' }: Props) {
  const { x, y } = tileToWorld(tx, ty);
  const w = TILE_W;
  const h = TILE_H;
  const pts = `${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}`;
  return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={0.5} />;
}
