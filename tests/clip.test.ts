import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { generate, stlOf } from '../src/generate.ts';
import { PRESETS } from '../src/params/presets.ts';
import { parseParams, type ClipParamsInput } from '../src/params/schema.ts';
import { derive } from '../src/rules/derive.ts';
import { getKernel, Scope } from '../src/geometry/kernel.ts';
import { buildClip } from '../src/geometry/clip.ts';
import { isClosedManifold } from '../src/export/clean.ts';
import type { MeshLike } from '../src/export/stl.ts';

/** Zero-area triangles at float32 precision (what the STL stores). */
function degenerate(m: MeshLike): number {
  const v = m.vertProperties, n = m.numProp, t = m.triVerts;
  let c = 0;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i]! * n, b = t[i + 1]! * n, d = t[i + 2]! * n;
    const ux = v[b]! - v[a]!, uy = v[b + 1]! - v[a + 1]!, uz = v[b + 2]! - v[a + 2]!;
    const wx = v[d]! - v[a]!, wy = v[d + 1]! - v[a + 1]!, wz = v[d + 2]! - v[a + 2]!;
    if (Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) < 1e-10) c++;
  }
  return c;
}

/** FUZZ_RUNS=500 FUZZ_SEED=1 npm test   for a deeper run */
const FUZZ = {
  numRuns: Number(process.env.FUZZ_RUNS ?? 60),
  seed: process.env.FUZZ_SEED ? Number(process.env.FUZZ_SEED) : 42,
};

describe('presets', () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    it(`${name} builds a valid two-body clip`, async () => {
      const r = await generate(preset.params);
      expect(r.issues.filter((i) => i.level === 'error')).toEqual([]);
      expect(r.report?.failures).toEqual([]);
      for (const m of [r.meshes!.base, r.meshes!.arm]) {
        expect(isClosedManifold(m), 'exported mesh is a closed 2-manifold').toBe(true);
        expect(degenerate(m), 'zero-area triangles in the STL').toBe(0);
      }
    });
  }
});

describe('STL export', () => {
  it('writes a binary STL with every triangle of both bodies', async () => {
    const r = await generate({});
    const stl = stlOf(r);
    const tris = (r.meshes!.base.triVerts.length + r.meshes!.arm.triVerts.length) / 3;
    expect(new DataView(stl.buffer).getUint32(80, true)).toBe(tris);
    expect(stl.byteLength).toBe(84 + 50 * tris);
  });
});

describe('derived dimensions', () => {
  it('width is n·pitch − play', () => {
    for (const n of [1, 2, 3, 4]) expect(derive(parseParams({ studsAcross: n })).W).toBeCloseTo(n * 8 - 0.2, 6);
  });
  it('length snaps to whole studs', () => {
    for (const cw of [6, 9.3, 14, 19.5, 27]) {
      const d = derive(parseParams({ channelWidth: cw }));
      const n = (d.xEnd - d.xPlate0 + d.play) / d.P;
      expect(Math.abs(n - Math.round(n))).toBeLessThan(1e-6);
    }
  });
  it('vertical hinge gaps are whole layers', () => {
    const d = derive(parseParams({ clearance: 0.25, layerHeight: 0.12 }));
    expect((d.gzL / 0.12) % 1).toBeCloseTo(0, 6);
    expect(d.gzL).toBeGreaterThanOrEqual(0.25);
  });
  it('default matches the original clip within 1 mm', () => {
    const d = derive(parseParams({}));
    expect(d.xEnd + d.Rb).toBeGreaterThan(59.9); // original 60.9 long
    expect(d.xEnd + d.Rb).toBeLessThan(61.9);
    expect(d.yTop + d.stud.height).toBeCloseTo(17.25, 1);
  });
});

/** Rotates the arm open about the hinge axis (part frame) and measures what it hits. */
async function opening(input: ClipParamsInput, angles: number[]) {
  const K = await getKernel();
  const S = new Scope();
  try {
    const p = parseParams(input);
    const d = derive(p);
    const { base, arm } = buildClip(K, S, p, d);
    const box = (x0: number, x1: number) => S.t(S.t(K.Manifold.cube([x1 - x0, 1e3, 1e3])).translate([x0, -500, -500]));
    const span = d.div.lipTip + (d.div.domeC - d.div.yLip) + 1.5;
    // latch: hook post, tongue, finger, plus the post's left lip (which also snaps in snap mode)
    const latch = box(Math.min(d.post.x0 - 0.5, d.post.xc - span), 1e3);
    const dividers = d.dividers.map((xc) => box(xc - span, xc + span));
    const allowed = S.t(K.Manifold.union([latch, ...(d.div.snap ? dividers : [])]));
    return angles.map((deg) => {
      const moved = S.t(S.t(S.t(arm.translate([0, -d.hy, 0])).rotate([0, 0, deg])).translate([0, d.hy, 0]));
      const hit = S.t(K.Manifold.intersection(base, moved));
      return {
        deg,
        total: hit.volume(),
        outside: S.t(hit.subtract(allowed)).volume(),
        atLatch: S.t(hit.intersect(latch)).volume(),
        atDividers: dividers.length ? S.t(hit.intersect(S.t(K.Manifold.union(dividers)))).volume() : 0,
        snap: d.div.snap,
        nDiv: d.dividers.length,
      };
    });
  } finally {
    S.free();
  }
}

describe('kinematics', () => {
  for (const name of ['default', 'usbc', 'power', 'bundle', 'slim', 'mixed', 'snap', 'original']) {
    it(`${name}: opens to 170° touching nothing but the latch (and snaps)`, async () => {
      const res = await opening(PRESETS[name]!.params, [1, 2, 3, 5, 10, 20, 45, 90, 135, 170]);
      for (const r of res) expect(r.outside, `collision at ${r.deg}°`).toBeLessThan(1e-3);
      // the hook latch must catch while just opening, and be free by 10°
      expect(Math.max(res[0]!.atLatch, res[1]!.atLatch), 'latch does not catch').toBeGreaterThan(0.05);
      for (const r of res.filter((x) => x.deg >= 10)) expect(r.total, `still engaged at ${r.deg}°`).toBeLessThan(1e-3);
      if (res[0]!.snap && res[0]!.nDiv > 0) {
        expect(Math.max(res[0]!.atDividers, res[1]!.atDividers), 'snap dividers do not engage').toBeGreaterThan(0.01);
      }
    }, 60_000);
  }
});

describe('fuzz', () => {
  it('any valid parameter set gives a valid clip or a clear error', async () => {
    const arb = fc.record({
      channelCount: fc.integer({ min: 1, max: 5 }),
      channelWidth: fc.double({ min: 3, max: 40, noNaN: true }),
      channelHeight: fc.double({ min: 6, max: 22, noNaN: true }),
      studsAcross: fc.integer({ min: 1, max: 4 }),
      snapLength: fc.boolean(),
      baseThickness: fc.double({ min: 2.4, max: 6, noNaN: true }),
      armThickness: fc.double({ min: 1.6, max: 6, noNaN: true }),
      dividerThickness: fc.double({ min: 1.2, max: 4, noNaN: true }),
      ballDiameter: fc.double({ min: 0, max: 5, noNaN: true }),
      dividerSnap: fc.boolean(),
      barrelDiameter: fc.double({ min: 5, max: 14, noNaN: true }),
      pinDiameter: fc.double({ min: 2, max: 8, noNaN: true }),
      middleKnuckle: fc.double({ min: 1.2, max: 12, noNaN: true }),
      clearance: fc.double({ min: 0.15, max: 0.6, noNaN: true }),
      catchOverlap: fc.double({ min: 0.3, max: 1.5, noNaN: true }),
      tabLength: fc.double({ min: 0, max: 10, noNaN: true }),
      studsOn: fc.boolean(),
      studFlare: fc.double({ min: 0, max: 0.5, noNaN: true }),
      studUndercut: fc.double({ min: 0, max: 40, noNaN: true }),
      bottomMode: fc.constantFrom('pockets', 'flat'),
      layerHeight: fc.constantFrom(0.12, 0.16, 0.2, 0.28),
    });
    await fc.assert(
      fc.asyncProperty(arb, async (input) => {
        const r = await generate(input);
        if (r.issues.some((i) => i.level === 'error')) return; // rejected up front, with a message
        expect(r.report?.failures).toEqual([]);
      }),
      FUZZ,
    );
  }, 900_000);

  it('random clips open without collisions outside the latch and snaps', async () => {
    const arb = fc.record({
      channelCount: fc.integer({ min: 1, max: 4 }),
      channelWidth: fc.double({ min: 4, max: 30, noNaN: true }),
      channelHeight: fc.double({ min: 7, max: 18, noNaN: true }),
      studsAcross: fc.integer({ min: 1, max: 3 }),
      barrelDiameter: fc.double({ min: 6, max: 11, noNaN: true }),
      clearance: fc.double({ min: 0.2, max: 0.45, noNaN: true }),
      dividerSnap: fc.boolean(),
      ballDiameter: fc.double({ min: 0, max: 4, noNaN: true }),
    });
    await fc.assert(
      fc.asyncProperty(arb, async (input) => {
        if (derive(parseParams(input)).issues.some((i) => i.level === 'error')) return;
        const res = await opening(input, [2, 10, 45, 90, 135, 170]);
        for (const r of res) expect(r.outside, `collision at ${r.deg}°`).toBeLessThan(1e-3);
      }),
      { ...FUZZ, numRuns: Math.ceil(FUZZ.numRuns / 2) },
    );
  }, 900_000);
});
