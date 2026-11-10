import { ClipParamsSchema, DEFAULTS, type ClipParams, type ClipParamsInput } from '../../params/schema.ts';
import { FIELD_BY_KEY, type ParamKey } from './fields.ts';
import { KIND_BY_ID, MAX_CABLES, MAX_D, MIN_D, ROOM, type Cable } from './cables.ts';

/**
 * Share links: only values that differ from the defaults go in the URL hash,
 * e.g. `#v=1&cables=phone,phone,8.5&studsAcross=3`. Channel sizes come from the
 * cable list, so they are not stored. Versioned so old links keep working.
 */
const VERSION = '1';
const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4);
const DERIVED: ParamKey[] = ['channelCount', 'channelWidth', 'channelWidths', 'channelHeight'];

export interface ShareState {
  params: ClipParamsInput;
  cables?: Cable[];
  room?: number;
}

export function encodeParams(p: ClipParams, skip: ParamKey[] = []): URLSearchParams {
  const out = new URLSearchParams({ v: VERSION });
  for (const [key, value] of Object.entries(p) as [ParamKey, unknown][]) {
    if (skip.includes(key) || value === undefined) continue;
    const def = DEFAULTS[key];
    if (Array.isArray(value)) out.set(key, value.map((x) => fmt(x as number)).join(','));
    else if (typeof value === 'number') { if (value !== def) out.set(key, fmt(value)); }
    else if (typeof value === 'boolean') { if (value !== def) out.set(key, value ? '1' : '0'); }
    else if (value !== def) out.set(key, String(value));
  }
  return out;
}

export function encodeState(params: ClipParams, cables: Cable[], room: number, defaults: { cables: Cable[]; room: number }): string {
  const q = encodeParams(params, DERIVED);
  const list = cables.map((c) => (c.kind === 'custom' ? fmt(c.d) : c.kind)).join(',');
  const defList = defaults.cables.map((c) => (c.kind === 'custom' ? fmt(c.d) : c.kind)).join(',');
  if (list !== defList) q.set('cables', list);
  if (room !== defaults.room) q.set('room', fmt(room));
  return q.toString().replace(/%2C/g, ',');
}

/** Tolerant decode: unknown keys and invalid values are dropped, never thrown. */
export function decodeParams(hash: string): ClipParamsInput {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const input: Record<string, unknown> = {};
  for (const [key, raw] of q) {
    const f = FIELD_BY_KEY[key as ParamKey];
    if (!f) continue;
    if (f.kind === 'number' || f.kind === 'integer') { const n = Number(raw); if (Number.isFinite(n)) input[key] = n; }
    else if (f.kind === 'boolean') input[key] = raw === '1' || raw === 'true';
    else if (f.kind === 'array') { const xs = raw.split(',').map(Number); if (xs.every(Number.isFinite)) input[key] = xs; }
    else input[key] = raw;
  }
  for (let i = 0; i < 64; i++) {
    const r = ClipParamsSchema.safeParse(input);
    if (r.success) break;
    const bad = r.error.issues[0]?.path[0];
    if (bad === undefined) break;
    delete input[String(bad)];
  }
  return input as ClipParamsInput;
}

export function decodeState(hash: string): ShareState {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const params = decodeParams(hash);
  const out: ShareState = { params };
  const raw = q.get('cables');
  if (raw) {
    const cables: Cable[] = [];
    for (const tok of raw.split(',').slice(0, MAX_CABLES)) {
      const kind = KIND_BY_ID[tok];
      const n = Number(tok);
      if (kind) cables.push({ kind: kind.id, d: kind.d });
      else if (Number.isFinite(n) && n >= MIN_D && n <= MAX_D) cables.push({ kind: 'custom', d: n });
    }
    if (cables.length) out.cables = cables;
  } else if (params.channelWidths?.length || params.channelCount) {
    // links made before the cable picker: turn channel widths back into custom cables
    const ws = params.channelWidths?.length ? params.channelWidths : Array.from({ length: params.channelCount ?? 2 }, () => params.channelWidth ?? DEFAULTS.channelWidth);
    out.cables = ws.slice(0, MAX_CABLES).map((w) => ({ kind: 'custom', d: Math.max(MIN_D, Math.round((w - ROOM.easy) * 10) / 10) }));
  }
  const room = Number(q.get('room'));
  if (q.has('room') && Number.isFinite(room) && room >= 0 && room <= 6) out.room = room;
  return out;
}
