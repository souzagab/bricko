import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { generate, stlOf } from '../src/generate.ts';
import { PRESETS } from '../src/params/presets.ts';
import { parseParams, type ClipParamsInput } from '../src/params/schema.ts';
import { derive } from '../src/rules/derive.ts';
import { getKernel, Scope } from '../src/geometry/kernel.ts';
import { buildClip } from '../src/geometry/clip.ts';

describe('presets', () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    it(`${name} builds a valid two-body clip`, async () => {
      const r = await generate(preset.params);
      expect(r.issues.filter((i) => i.level === 'error')).toEqual([]);
      expect(r.report?.failures).toEqual([]);
      expect(r.report?.ok).toBe(true);
    });
  }
});

describe('STL export', () => {
  it('writes a binary STL with every triangle of both bodies', async () => {
    const r = await generate({});
    const stl = stlOf(r);
    const tris = (r.meshes!.base.triVerts.length + r.meshes!.arm.triVerts.length) / 3;
    const dv = new DataView(stl.buffer);
    expect(dv.getUint32(80, true)).toBe(tris);
    expect(stl.byteLength).toBe(84 + 50 * tris);
  });
});

describe('derived dimensions', () => {
  it('stud width mode matches brick play (n·8 − 0.2)', () => {
    for (const n of [1, 2, 3, 4]) expect(derive(parseParams({ studsAcross: n })).W).toBeCloseTo(n * 8 - 0.2, 6);
  });
  it('Z gaps are whole layers in flat orientation', () => {
    const d = derive(parseParams({ radialClearance: 0.3, layerHeight: 0.12 }));
    expect((d.gz / 0.12) % 1).toBeCloseTo(0, 6);
    expect(d.gz).toBeGreaterThanOrEqual(0.24);
  });
  it('socket cavity walls are 1.5 mm for stud-width clips', () => {
    const d = derive(parseParams({}));
    const zs = d.socketGrid!.zs;
    const span = zs[zs.length - 1]! - zs[0]! + 4.8;
    expect((d.W - span) / 2).toBeCloseTo(1.5, 6);
  });
});

/** Rotates the arm open about the hinge axis (part frame). Only the latch may collide. */
async function openingCollisions(input: ClipParamsInput, angles: number[]) {
  const K = await getKernel();
  const S = new Scope();
  try {
    const p = parseParams(input);
    const d = derive(p);
    const { base, arm } = buildClip(K, S, p, d);
    const box = (x0: number, x1: number, y0: number, y1: number) =>
      S.t(S.t(K.Manifold.cube([x1 - x0, y1 - y0, 1e3])).translate([x0, y0, -500]));
    const latchZone = box(d.walls[d.walls.length - 1]!.x0 - 0.5, 1e3, -500, 500);
    const snapZones = d.snaps.map((sn) => box(sn.xc - sn.wf / 2 - 1, sn.xc + sn.wf / 2 + 1, sn.yHead - 1, d.ya0 + 1));
    const allowed = S.t(K.Manifold.union([latchZone, ...snapZones]));
    return angles.map((deg) => {
      const moved = S.t(S.t(S.t(arm.translate([0, -d.hy, 0])).rotate([0, 0, deg])).translate([0, d.hy, 0]));
      const hit = S.t(K.Manifold.intersection(base, moved));
      const outsideLatch = S.t(hit.subtract(allowed)).volume();
      const inSnaps = snapZones.length ? S.t(hit.intersect(S.t(K.Manifold.union(snapZones)))).volume() : 0;
      return { deg, total: hit.volume(), outsideLatch, inSnaps, snaps: d.snaps.length };
    });
  } finally {
    S.free();
  }
}

describe('kinematics', () => {
  for (const name of ['default', 'usbc', 'power', 'bundle', 'slim', 'mixed']) {
    it(`${name}: arm opens to 150° touching nothing but the latch and snaps`, async () => {
      const res = await openingCollisions(PRESETS[name]!.params, [2, 5, 10, 20, 35, 60, 90, 120, 150]);
      for (const r of res) expect(r.outsideLatch, `collision at ${r.deg}°`).toBeLessThan(1e-3);
      // latch and snaps must actually catch: interference while just opening, then free
      expect(res[0]!.total).toBeGreaterThan(1e-3);
      if (res[0]!.snaps > 0) expect(res[0]!.inSnaps, 'snaps do not engage').toBeGreaterThan(1e-3);
      for (const r of res.filter((x) => x.deg >= 35)) expect(r.total, `latch still engaged at ${r.deg}°`).toBeLessThan(1e-3);
    }, 30_000);
  }
});

/** FUZZ_RUNS=500 FUZZ_SEED=1 npm test   for a deeper run */
const FUZZ = {
  numRuns: Number(process.env.FUZZ_RUNS ?? 60),
  seed: process.env.FUZZ_SEED ? Number(process.env.FUZZ_SEED) : 42,
};

describe('fuzz', () => {
  it('any valid parameter set gives a valid clip or a clear error', async () => {
    const arb = fc.record({
      channelCount: fc.integer({ min: 1, max: 5 }),
      channelWidth: fc.double({ min: 3, max: 40, noNaN: true }),
      channelHeight: fc.double({ min: 3, max: 25, noNaN: true }),
      studsAcross: fc.integer({ min: 1, max: 4 }),
      baseThickness: fc.double({ min: 2, max: 6, noNaN: true }),
      armThickness: fc.double({ min: 1.6, max: 6, noNaN: true }),
      dividerThickness: fc.double({ min: 1.2, max: 4, noNaN: true }),
      barrelDiameter: fc.double({ min: 5, max: 14, noNaN: true }),
      radialClearance: fc.double({ min: 0.15, max: 0.6, noNaN: true }),
      axialClearance: fc.double({ min: 0.15, max: 0.6, noNaN: true }),
      knuckles: fc.constantFrom(3, 5),
      catchDepth: fc.double({ min: 0.3, max: 1.5, noNaN: true }),
      tabLength: fc.double({ min: 0, max: 10, noNaN: true }),
      studsOn: fc.boolean(),
      bottomMode: fc.constantFrom('cavity', 'holes', 'flat'),
      orientation: fc.constantFrom('flat', 'side'),
      layerHeight: fc.constantFrom(0.12, 0.16, 0.2, 0.28),
      dividerSnaps: fc.boolean(),
      snapBulb: fc.double({ min: 1.6, max: 5, noNaN: true }),
      snapStem: fc.double({ min: 0.8, max: 2.5, noNaN: true }),
    });
    await fc.assert(
      fc.asyncProperty(arb, async (input) => {
        const r = await generate(input);
        if (r.issues.some((i) => i.level === 'error')) return; // rejected up front, with a message
        expect(r.report?.failures).toEqual([]);
      }),
      FUZZ,
    );
  }, 600_000);

  it('random clips open without collisions outside the latch', async () => {
    const arb = fc.record({
      channelCount: fc.integer({ min: 1, max: 4 }),
      channelWidth: fc.double({ min: 3, max: 30, noNaN: true }),
      channelHeight: fc.double({ min: 4, max: 20, noNaN: true }),
      studsAcross: fc.integer({ min: 1, max: 3 }),
      baseThickness: fc.double({ min: 2.5, max: 5, noNaN: true }),
      barrelDiameter: fc.double({ min: 5, max: 12, noNaN: true }),
      radialClearance: fc.double({ min: 0.2, max: 0.5, noNaN: true }),
      dividerThickness: fc.double({ min: 1.6, max: 3, noNaN: true }),
      keyDepth: fc.double({ min: 0, max: 1.2, noNaN: true }),
      dividerSnaps: fc.boolean(),
      snapBulb: fc.double({ min: 2, max: 4, noNaN: true }),
    });
    await fc.assert(
      fc.asyncProperty(arb, async (input) => {
        if (derive(parseParams(input)).issues.some((i) => i.level === 'error')) return;
        const res = await openingCollisions(input, [3, 10, 30, 60, 100, 135]);
        for (const r of res) expect(r.outsideLatch, `collision at ${r.deg}°`).toBeLessThan(1e-3);
      }),
      { ...FUZZ, numRuns: Math.ceil(FUZZ.numRuns / 2) },
    );
  }, 600_000);
});
