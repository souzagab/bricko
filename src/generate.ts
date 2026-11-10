import { parseParams, type ClipParams } from './params/schema.ts';
import { derive, type Derived, type Issue } from './rules/derive.ts';
import { getKernel, Scope } from './geometry/kernel.ts';
import { buildClip } from './geometry/clip.ts';
import { toBed } from './geometry/orient.ts';
import { checkClip, type CheckReport } from './geometry/checks.ts';
import { toBinaryStl, type MeshLike } from './export/stl.ts';
import { cleanMesh } from './export/clean.ts';

export interface GenerateResult {
  params: ClipParams;
  derived: Derived;
  issues: Issue[];
  report: CheckReport | null;
  meshes: { base: MeshLike; arm: MeshLike } | null;
  /** part frame -> bed frame translation (the hinge axis is at part (0, hy)) */
  shift: [number, number, number] | null;
  ms: number;
}

/** params in -> meshes + validation out. Pure apart from the WASM module. Used by the CLI, the tests and (later) the web worker. */
export async function generate(input: unknown): Promise<GenerateResult> {
  const t0 = performance.now();
  const params = parseParams(input);
  const derived = derive(params);
  const issues = derived.issues;
  if (issues.some((i) => i.level === 'error')) {
    return { params, derived, issues, report: null, meshes: null, shift: null, ms: performance.now() - t0 };
  }
  const K = await getKernel();
  K.setMinCircularAngle(5);
  K.setMinCircularEdgeLength(params.segmentLength);
  const S = new Scope();
  try {
    const part = buildClip(K, S, params, derived);
    const { base, arm, shift } = toBed(K, S, params, part);
    const report = checkClip(K, S, derived, base, arm);
    // cleanMesh copies out of WASM memory and welds float32 needles (see clean.ts)
    const copy = (m: ReturnType<typeof base.getMesh>): MeshLike => cleanMesh(m);
    const meshes = { base: copy(base.getMesh()), arm: copy(arm.getMesh()) };
    return { params, derived, issues, report, meshes, shift, ms: performance.now() - t0 };
  } finally {
    S.free();
  }
}

export function stlOf(r: GenerateResult): Uint8Array {
  if (!r.meshes) throw new Error('no geometry (see issues)');
  return toBinaryStl([r.meshes.base, r.meshes.arm]);
}
