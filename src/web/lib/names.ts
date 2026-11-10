import type { ClipParams } from '../../params/schema.ts';
import type { Cable } from './cables.ts';

const n = (v: number) => String(Math.round(v * 10) / 10).replace('.', 'p');

/** e.g. bricko_phone-phone-power_2wide.stl: named after what it holds. */
export function fileName(p: ClipParams, cables?: Cable[]): string {
  const what = cables?.length
    ? cables.map((c) => (c.kind === 'custom' ? `${n(c.d)}mm` : c.kind)).join('-')
    : p.channelWidths?.length ? p.channelWidths.map(n).join('-') : `${p.channelCount}x${n(p.channelWidth)}`;
  const snap = p.dividerSnap ? '_snap' : '';
  return `bricko_${what}_${p.studsAcross}wide${snap}.stl`;
}
