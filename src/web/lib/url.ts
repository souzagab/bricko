import { ClipParamsSchema, DEFAULTS, type ClipParams, type ClipParamsInput } from '../../params/schema.ts';
import { FIELD_BY_KEY, type ParamKey } from './fields.ts';

/**
 * Share links: only values that differ from the defaults go in the URL hash,
 * e.g. `#v=1&channelCount=3&channelWidth=7`. Versioned so old links keep working.
 */
const VERSION = '1';

const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4);

export function encodeParams(p: ClipParams): string {
  const out = new URLSearchParams({ v: VERSION });
  for (const [key, value] of Object.entries(p) as [ParamKey, unknown][]) {
    const def = DEFAULTS[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) out.set(key, value.map((x) => fmt(x as number)).join(','));
    else if (typeof value === 'number') { if (value !== def) out.set(key, fmt(value)); }
    else if (typeof value === 'boolean') { if (value !== def) out.set(key, value ? '1' : '0'); }
    else if (value !== def) out.set(key, String(value));
  }
  return out.toString();
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
  // Drop whatever the schema rejects, one key at a time
  for (let i = 0; i < 64; i++) {
    const r = ClipParamsSchema.safeParse(input);
    if (r.success) break;
    const bad = r.error.issues[0]?.path[0];
    if (bad === undefined) break;
    delete input[String(bad)];
  }
  return input as ClipParamsInput;
}
