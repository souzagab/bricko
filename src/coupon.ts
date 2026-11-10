import type { Manifold } from 'manifold-3d';
import { parseParams, type ClipParams } from './params/schema.ts';
import { derive } from './rules/derive.ts';
import { getKernel, Scope } from './geometry/kernel.ts';
import { buildClip } from './geometry/clip.ts';
import { toBed } from './geometry/orient.ts';
import { checkClip } from './geometry/checks.ts';
import type { MeshLike } from './export/stl.ts';
import { cleanMesh } from './export/clean.ts';

/**
 * Test print: five small clips (2 studs wide, one short channel), each a step
 * looser than the last. Every clip varies three things at once, and they are
 * read independently:
 *   hinge   -> clearance
 *   studs   -> stud fit (a real brick pressed on top)
 *   pockets -> socket fit (the clip pressed onto a real brick)
 * Clip k carries k+1 dots on its end so it can be identified after printing.
 */
export const COUPON_STEPS = [-2, -1, 0, 1, 2] as const;
const STEP = { clearance: 0.05, studFit: 0.04, socketFit: 0.04 };

export interface CouponSpec { dots: number; clearance: number; studFit: number; socketFit: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function couponSpecs(p: ClipParams): CouponSpec[] {
  return COUPON_STEPS.map((k, i) => ({
    dots: i + 1,
    clearance: r3(clamp(p.clearance + k * STEP.clearance, 0.1, 0.8)),
    studFit: r3(clamp(p.studFit + k * STEP.studFit, -0.3, 0.3)),
    socketFit: r3(clamp(p.socketFit + k * STEP.socketFit, -0.2, 0.4)),
  }));
}

export interface CouponResult {
  specs: CouponSpec[];
  meshes: { base: MeshLike; arm: MeshLike };
  ok: boolean;
  failures: string[];
  size: [number, number, number];
  ms: number;
}

export async function generateCoupon(input: unknown): Promise<CouponResult> {
  const t0 = performance.now();
  const p = parseParams(input);
  const specs = couponSpecs(p);
  const K = await getKernel();
  K.setMinCircularAngle(5);
  K.setMinCircularEdgeLength(p.segmentLength);
  const S = new Scope();
  try {
    const bases: Manifold[] = [];
    const arms: Manifold[] = [];
    const failures: string[] = [];
    let y = 0;
    for (const s of specs) {
      const mp = parseParams({
        ...p, studsAcross: 2, channelCount: 1, channelWidths: undefined, channelWidth: 4, channelHeight: 7,
        tabLength: 3, snapLength: true, studsOn: true, bottomMode: 'pockets',
        clearance: s.clearance, studFit: s.studFit, socketFit: s.socketFit,
      });
      const d = derive(mp);
      const err = d.issues.find((i) => i.level === 'error');
      if (err) { failures.push(`clip ${s.dots}: ${err.message}`); continue; }
      const part = buildClip(K, S, mp, d);
      // identification dots on the end of the base plate
      const dots: Manifold[] = [];
      for (let k = 0; k < s.dots; k++) {
        const z = d.W / 2 + (k - (s.dots - 1) / 2) * 1.8;
        dots.push(S.t(S.t(S.t(K.Manifold.cylinder(0.7, 0.55)).rotate([0, 90, 0])).translate([d.xEnd - 0.05, d.tb / 2, z])));
      }
      const base = S.t(part.base.add(S.t(K.Manifold.union(dots))));
      const bed = toBed(K, S, mp, { base, arm: part.arm });
      const rep = checkClip(K, S, d, bed.base, bed.arm);
      for (const f of rep.failures) failures.push(`clip ${s.dots}: ${f}`);
      // lay the clips side by side along bed Y, 4 mm apart
      const bb = S.t(K.Manifold.compose([bed.base, bed.arm])).boundingBox();
      const dy = y - bb.min[1];
      bases.push(S.t(bed.base.translate([0, dy, 0])));
      arms.push(S.t(bed.arm.translate([0, dy, 0])));
      y += bb.max[1] - bb.min[1] + 4;
    }
    const base = S.t(K.Manifold.compose(bases));
    const arm = S.t(K.Manifold.compose(arms));
    const both = S.t(K.Manifold.compose([base, arm]));
    const bb = both.boundingBox();
    const shift: [number, number, number] = [-(bb.min[0] + bb.max[0]) / 2, -(bb.min[1] + bb.max[1]) / 2, 0];
    const copy = (m: Manifold): MeshLike => {
      return cleanMesh(S.t(m.translate(shift)).getMesh());
    };
    return {
      specs, meshes: { base: copy(base), arm: copy(arm) }, ok: failures.length === 0, failures,
      size: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]], ms: performance.now() - t0,
    };
  } finally {
    S.free();
  }
}
