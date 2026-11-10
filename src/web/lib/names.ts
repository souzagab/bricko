import type { ClipParams } from '../../params/schema.ts';

const n = (v: number) => String(Math.round(v * 10) / 10).replace('.', 'p');

/** e.g. bricko_2x19p5mm_h9p2_2w_c0p25.stl: readable and unique per configuration family. */
export function fileName(p: ClipParams): string {
  const widths = p.channelWidths?.length ? p.channelWidths.map(n).join('-') : `${p.channelCount}x${n(p.channelWidth)}`;
  const snap = p.dividerSnap ? '_snap' : '';
  return `bricko_${widths}mm_h${n(p.channelHeight)}_${p.studsAcross}w_c${String(p.clearance).replace('.', 'p')}${snap}.stl`;
}
