import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Derived } from '../rules/derive.ts';
import type { Scope } from './kernel.ts';

export interface CheckReport {
  ok: boolean;
  baseStatus: string;
  armStatus: string;
  baseParts: number;
  armParts: number;
  overlapVolume: number;
  minGap: number;
  requiredGap: number;
  zMin: number;
  size: [number, number, number];
  volumeCm3: number;
  failures: string[];
}

/** Invariants every generated clip must satisfy before anyone downloads it. */
export function checkClip(K: ManifoldToplevel, S: Scope, d: Derived, base: Manifold, arm: Manifold): CheckReport {
  const t = S.t;
  const failures: string[] = [];
  const baseStatus = base.status();
  const armStatus = arm.status();
  if (baseStatus !== 'NoError') failures.push(`base status ${baseStatus}`);
  if (armStatus !== 'NoError') failures.push(`arm status ${armStatus}`);

  const countParts = (m: Manifold) => {
    const parts = m.decompose();
    const n = parts.length;
    for (const x of parts) x.delete();
    return n;
  };
  const baseParts = countParts(base);
  const armParts = countParts(arm);
  if (baseParts !== 1) failures.push(`base has ${baseParts} pieces (expected 1)`);
  if (armParts !== 1) failures.push(`arm has ${armParts} pieces (expected 1)`);

  const overlapVolume = t(K.Manifold.intersection(base, arm)).volume();
  if (overlapVolume > 1e-4) failures.push(`base and arm overlap (${overlapVolume.toFixed(4)} mm³)`);

  const requiredGap = Math.min(d.c, d.ga, d.gz) - 1e-3;
  const minGap = base.minGap(arm, 2);
  if (minGap < requiredGap) failures.push(`min gap ${minGap.toFixed(3)} < ${requiredGap.toFixed(3)} mm`);

  const both = t(K.Manifold.compose([base, arm]));
  const bb = both.boundingBox();
  const zMin = bb.min[2];
  if (Math.abs(zMin) > 1e-3) failures.push(`not on bed (z min ${zMin.toFixed(3)})`);

  return {
    ok: failures.length === 0,
    baseStatus, armStatus, baseParts, armParts, overlapVolume, minGap, requiredGap, zMin,
    size: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]],
    volumeCm3: both.volume() / 1000,
    failures,
  };
}
