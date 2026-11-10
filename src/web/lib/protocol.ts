import type { ClipParams, ClipParamsInput } from '../../params/schema.ts';
import type { Issue } from '../../rules/derive.ts';
import type { CheckReport } from '../../geometry/checks.ts';
import type { MeshLike } from '../../export/stl.ts';
import type { CouponResult } from '../../coupon.ts';

export interface BuildResult {
  params: ClipParams;
  issues: Issue[];
  report: CheckReport | null;
  meshes: { base: MeshLike; arm: MeshLike } | null;
  shift: [number, number, number] | null;
  ms: number;
  hy: number; // hinge axis height in the part frame
  W: number;
  clearance: number;
  channels: { x0: number; x1: number }[]; // part frame
  tb: number; // channel floor height, part frame
}

export type WorkerRequest = { id: number; kind: 'clip' | 'coupon'; params: ClipParamsInput };
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; id: number; result: BuildResult }
  | { type: 'coupon'; id: number; result: CouponResult }
  | { type: 'error'; id: number; kind: 'clip' | 'coupon'; message: string };
