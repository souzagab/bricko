import { describe, expect, it } from 'vitest';
import { ClipParamsSchema, DEFAULTS, parseParams } from '../src/params/schema.ts';
import { PRESETS } from '../src/params/presets.ts';
import { FIELDS, FIELD_BY_KEY, GROUPS, decimals } from '../src/web/lib/fields.ts';
import { decodeParams, decodeState, encodeParams, encodeState } from '../src/web/lib/url.ts';
import { CABLE_KINDS, DEFAULT_CABLES, MAX_D, MIN_D, ROOM, cablesToParams } from '../src/web/lib/cables.ts';
import { derive } from '../src/rules/derive.ts';
import { generate } from '../src/generate.ts';
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
  const defaults = { cables: DEFAULT_CABLES, room: ROOM.easy };
  it('a fresh clip encodes to just the version', () => {
    const p = parseParams(cablesToParams(DEFAULT_CABLES, ROOM.easy));
    expect(encodeState(p, DEFAULT_CABLES, ROOM.easy, defaults)).toBe('v=1');
  });
  it('round-trips cables, room and settings', () => {
    const cables = [{ kind: 'hdmi', d: 7.5 }, { kind: 'custom', d: 5.5 }];
    const p = parseParams({ ...cablesToParams(cables, 0.5), studsAcross: 3, dividerSnap: true, clearance: 0.32 });
    const s = decodeState('#' + encodeState(p, cables, 0.5, defaults));
    expect(s.cables).toEqual(cables);
    expect(s.room).toBe(0.5);
    expect(parseParams({ ...s.params, ...cablesToParams(s.cables!, s.room!) })).toEqual(p);
  });
  it('round-trips every preset (CLI parameter links)', () => {
    for (const [name, pr] of Object.entries(PRESETS)) {
      const full = parseParams(pr.params);
      expect(parseParams(decodeParams('#' + encodeParams(full).toString())), name).toEqual(full);
    }
  });
  it('drops junk instead of throwing', () => {
    const d = decodeParams('#v=1&studsAcross=3&channelWidth=banana&clearance=9&nope=1&dividerSnap=1');
    expect(d).toEqual({ studsAcross: 3, dividerSnap: true });
    expect(decodeState('#cables=phone,banana,99,4.5').cables).toEqual([{ kind: 'phone', d: 4 }, { kind: 'custom', d: 4.5 }]);
  });
  it('old channel-width links become custom cables', () => {
    expect(decodeState('#v=1&channelCount=2&channelWidth=10').cables).toEqual([{ kind: 'custom', d: 8.5 }, { kind: 'custom', d: 8.5 }]);
  });
});

describe('main panel can never produce an error', () => {
  it('any cable mix, width, fit and brick option builds', () => {
    const mixes = [
      ...CABLE_KINDS.map((k) => [{ kind: k.id, d: k.d }]),
      CABLE_KINDS.map((k) => ({ kind: k.id, d: k.d })),
      Array.from({ length: 8 }, () => ({ kind: 'aux', d: 3 })),
      Array.from({ length: 8 }, () => ({ kind: 'power', d: 8 })),
      [{ kind: 'custom', d: MIN_D }], [{ kind: 'custom', d: MAX_D }], [{ kind: 'custom', d: 1.5 }, { kind: 'custom', d: 30 }],
    ];
    for (const cables of mixes) for (const room of [ROOM.snug, ROOM.easy]) for (const studsAcross of [1, 2, 3, 4])
      for (const clearance of [0.2, 0.25, 0.32]) for (const studsOn of [true, false]) {
        const d = derive(parseParams({ ...cablesToParams(cables, room), studsAcross, clearance, studsOn }));
        const errs = d.issues.filter((i) => i.level === 'error').map((i) => i.message);
        expect(errs, JSON.stringify({ cables, room, studsAcross, clearance })).toEqual([]);
      }
  });
  it('a few of those build real geometry', async () => {
    for (const [cables, w] of [[[{ kind: 'aux', d: 3 }], 1], [CABLE_KINDS.map((k) => ({ kind: k.id, d: k.d })), 4], [[{ kind: 'custom', d: 30 }], 2]] as const) {
      const r = await generate({ ...cablesToParams([...cables], ROOM.snug), studsAcross: w });
      expect(r.report?.failures, JSON.stringify(cables)).toEqual([]);
    }
  }, 60_000);
});

describe('file names', () => {
  it('are named after the cables and filesystem-safe', () => {
    expect(fileName(DEFAULTS, DEFAULT_CABLES)).toBe('bricko_phone-phone-power_2wide.stl');
    expect(fileName(parseParams({ dividerSnap: true, studsAcross: 3 }), [{ kind: 'custom', d: 5.5 }])).toBe('bricko_5p5mm_3wide_snap.stl');
    expect(fileName(parseParams({ channelCount: 3, channelWidths: [6, 10, 14] }))).toBe('bricko_6-10-14_2wide.stl');
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
