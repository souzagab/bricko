import { describe, expect, it } from 'vitest';
import { ClipParamsSchema, DEFAULTS, parseParams } from '../src/params/schema.ts';
import { PRESETS } from '../src/params/presets.ts';
import { FIELDS, FIELD_BY_KEY, GROUPS, decimals } from '../src/web/lib/fields.ts';
import { decodeParams, encodeParams } from '../src/web/lib/url.ts';
import { fileName } from '../src/web/lib/names.ts';
import { couponSpecs, generateCoupon } from '../src/coupon.ts';

describe('fields from schema', () => {
  it('every parameter gets a field with a group, label and sane range', () => {
    expect(FIELDS.map((f) => f.key).sort()).toEqual(Object.keys(ClipParamsSchema.shape).sort());
    const groups = new Set(GROUPS.map((g) => g.id));
    for (const f of FIELDS) {
      expect(groups.has(f.group), f.key).toBe(true);
      expect(f.label.length, f.key).toBeGreaterThan(0);
      if (f.kind === 'number' || f.kind === 'integer') {
        expect(f.min, f.key).toBeTypeOf('number');
        expect(f.max!, f.key).toBeGreaterThan(f.min!);
        expect(f.def, f.key).toBe(DEFAULTS[f.key]);
      }
    }
    expect(FIELD_BY_KEY.bottomMode.options?.map((o) => o.value)).toEqual(['pockets', 'flat']);
    expect(FIELD_BY_KEY.channelWidths.kind).toBe('array');
  });
  it('decimals follow the step', () => {
    expect(decimals(1)).toBe(0);
    expect(decimals(0.5)).toBe(1);
    expect(decimals(0.05)).toBe(2);
    expect(decimals(0.01)).toBe(2);
  });
});

describe('share links', () => {
  it('defaults encode to just the version', () => {
    expect(encodeParams(DEFAULTS)).toBe('v=1');
  });
  it('round-trips every preset', () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      const full = parseParams(p.params);
      expect(parseParams(decodeParams('#' + encodeParams(full))), name).toEqual(full);
    }
  });
  it('drops junk instead of throwing', () => {
    const d = decodeParams('#v=1&channelCount=3&channelWidth=banana&clearance=9&nope=1&dividerSnap=1&channelWidths=4,5,x');
    expect(d).toEqual({ channelCount: 3, dividerSnap: true });
  });
});

describe('file names', () => {
  it('are readable and filesystem-safe', () => {
    expect(fileName(DEFAULTS)).toBe('bricko_2x19p5mm_h9p2_2w_c0p25.stl');
    expect(fileName(parseParams({ channelCount: 3, channelWidths: [6, 10, 14], dividerSnap: true }))).toMatch(/^bricko_6-10-14mm_h9p2_2w_c0p25_snap\.stl$/);
  });
});

describe('test print', () => {
  it('steps around the current settings, centre = current', () => {
    const s = couponSpecs(DEFAULTS);
    expect(s.map((x) => x.dots)).toEqual([1, 2, 3, 4, 5]);
    expect(s[2]).toMatchObject({ clearance: DEFAULTS.clearance, studFit: DEFAULTS.studFit, socketFit: DEFAULTS.socketFit });
    expect(s[4]!.clearance).toBeGreaterThan(s[0]!.clearance);
  });
  it('builds five valid clips', async () => {
    const r = await generateCoupon({});
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.size[2]).toBeCloseTo(15.8, 1); // printed on its side, 2 studs tall
  }, 60_000);
});
