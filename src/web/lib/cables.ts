import type { ClipParams } from '../../params/schema.ts';

/**
 * People think in cables, not channels. Each cable becomes one channel sized
 * from its thickness plus some "room". The channel height follows the thickest
 * cable.
 */
export interface CableKind { id: string; label: string; hint: string; d: number }

export const CABLE_KINDS: CableKind[] = [
  { id: 'aux', label: 'Earphones / AUX', hint: 'thin audio cable', d: 3 },
  { id: 'phone', label: 'Phone charger', hint: 'USB-C, Lightning, micro-USB', d: 4 },
  { id: 'laptop', label: 'Laptop charger (USB-C)', hint: 'thicker 60–100 W cable', d: 5 },
  { id: 'ethernet', label: 'Network (Ethernet)', hint: 'Cat 5e / Cat 6', d: 6 },
  { id: 'hdmi', label: 'HDMI / DisplayPort', hint: 'monitor cable', d: 7.5 },
  { id: 'power', label: 'Power cord', hint: 'mains cable', d: 8 },
];
export const KIND_BY_ID = Object.fromEntries(CABLE_KINDS.map((k) => [k.id, k])) as Record<string, CableKind>;

export type Cable = { kind: string; d: number }; // kind is a CABLE_KINDS id or 'custom'
export const MAX_CABLES = 8;
export const MIN_D = 1.5, MAX_D = 30;

/** Room added around each cable: snug cables click past the divider tips and stay put, easy ones drop in. */
export const ROOM = { snug: 0.5, easy: 1.5 } as const;
export type Fit = keyof typeof ROOM;
export const fitOf = (room: number): Fit | null =>
  (Object.entries(ROOM).find(([, v]) => Math.abs(v - room) < 1e-6)?.[0] as Fit | undefined) ?? null;

export const DEFAULT_CABLES: Cable[] = [
  { kind: 'phone', d: 4 },
  { kind: 'phone', d: 4 },
  { kind: 'power', d: 8 },
];

const r1 = (v: number) => Math.round(v * 10) / 10;

export function cablesToParams(cables: Cable[], room: number): Pick<ClipParams, 'channelCount' | 'channelWidth' | 'channelWidths' | 'channelHeight'> {
  const list = cables.length ? cables : DEFAULT_CABLES;
  const widths = list.map((c) => Math.min(60, Math.max(3, r1(c.d + room))));
  const height = Math.min(30, Math.max(6.5, r1(Math.max(...list.map((c) => c.d)) + room)));
  return { channelCount: widths.length, channelWidth: widths[0]!, channelWidths: widths, channelHeight: height };
}

export const cableLabel = (c: Cable) => (c.kind === 'custom' ? `Custom ${c.d} mm` : `${KIND_BY_ID[c.kind]?.label ?? 'Cable'} · ${c.d} mm`);
