import type { MeshLike } from './stl.ts';

/**
 * Manifold works in double precision. A few needle triangles (one edge
 * ~1e-7 mm) are valid there, but become zero-area once written as 32-bit
 * floats, and strict tools (and some slicers) then report holes. Weld vertices
 * closer than `tol` (an edge collapse) and drop the triangles that collapse.
 * Positions only: properties beyond xyz are dropped.
 */
export function cleanMesh(m: MeshLike, tol = 1e-4): MeshLike {
  const n = m.numProp;
  const src = m.vertProperties;
  const count = src.length / n;
  const inv = 1 / tol;
  const cells = new Map<string, number[]>();
  const remap = new Uint32Array(count);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = src[i * n]!, y = src[i * n + 1]!, z = src[i * n + 2]!;
    const cx = Math.round(x * inv), cy = Math.round(y * inv), cz = Math.round(z * inv);
    let found = -1;
    search: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const bucket = cells.get(`${cx + dx},${cy + dy},${cz + dz}`);
      if (!bucket) continue;
      for (const j of bucket) {
        if (Math.abs(out[j * 3]! - x) <= tol && Math.abs(out[j * 3 + 1]! - y) <= tol && Math.abs(out[j * 3 + 2]! - z) <= tol) { found = j; break search; }
      }
    }
    if (found < 0) {
      found = out.length / 3;
      out.push(x, y, z);
      const k = `${cx},${cy},${cz}`;
      const b = cells.get(k);
      if (b) b.push(found); else cells.set(k, [found]);
    }
    remap[i] = found;
  }
  const tris: number[] = [];
  const t = m.triVerts;
  for (let i = 0; i < t.length; i += 3) {
    const a = remap[t[i]!]!, b = remap[t[i + 1]!]!, c = remap[t[i + 2]!]!;
    if (a !== b && b !== c && c !== a) tris.push(a, b, c);
  }
  const pos = new Float32Array(out);
  flipCaps(pos, tris);
  return { numProp: 3, vertProperties: pos, triVerts: new Uint32Array(tris) };
}

/** |cross| of a triangle, computed from the float32 positions the STL will store. */
function cross2(p: Float32Array, a: number, b: number, c: number): number {
  const ux = p[b * 3]! - p[a * 3]!, uy = p[b * 3 + 1]! - p[a * 3 + 1]!, uz = p[b * 3 + 2]! - p[a * 3 + 2]!;
  const wx = p[c * 3]! - p[a * 3]!, wy = p[c * 3 + 1]! - p[a * 3 + 1]!, wz = p[c * 3 + 2]! - p[a * 3 + 2]!;
  return Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx);
}
const len2 = (p: Float32Array, a: number, b: number) =>
  (p[a * 3]! - p[b * 3]!) ** 2 + (p[a * 3 + 1]! - p[b * 3 + 1]!) ** 2 + (p[a * 3 + 2]! - p[b * 3 + 2]!) ** 2;

/**
 * Removes "caps": zero-area triangles whose three points are collinear, with no
 * short edge to collapse. Flip the long edge with the neighbour across it:
 * cap (a,b,c), with b on segment a–c, and neighbour (a,c,d) become (a,b,d) and
 * (b,c,d). Every edge stays paired, so the mesh stays a closed 2-manifold.
 */
function flipCaps(pos: Float32Array, tris: number[], eps = 1e-10): void {
  const key = (u: number, v: number) => u * 0x100000 + v;
  const edge = new Map<number, number>(); // directed edge -> triangle index
  const index = (t: number) => { for (let k = 0; k < 3; k++) edge.set(key(tris[t * 3 + k]!, tris[t * 3 + ((k + 1) % 3)]!), t); };
  const unindex = (t: number) => { for (let k = 0; k < 3; k++) edge.delete(key(tris[t * 3 + k]!, tris[t * 3 + ((k + 1) % 3)]!)); };
  const nt = tris.length / 3;
  for (let t = 0; t < nt; t++) index(t);
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let t = 0; t < nt; t++) {
      const v = [tris[t * 3]!, tris[t * 3 + 1]!, tris[t * 3 + 2]!];
      if (cross2(pos, v[0]!, v[1]!, v[2]!) >= eps) continue;
      // rotate so the longest edge is c -> a and b is the middle point
      let k = 0, best = -1;
      for (let i = 0; i < 3; i++) { const l = len2(pos, v[(i + 2) % 3]!, v[i]!); if (l > best) { best = l; k = i; } }
      const a = v[k]!, b = v[(k + 1) % 3]!, c = v[(k + 2) % 3]!;
      const t2 = edge.get(key(a, c));
      if (t2 === undefined || t2 === t) continue;
      const w = [tris[t2 * 3]!, tris[t2 * 3 + 1]!, tris[t2 * 3 + 2]!];
      const d = w.find((x) => x !== a && x !== c);
      if (d === undefined || d === b) continue;
      unindex(t); unindex(t2);
      tris[t * 3] = a; tris[t * 3 + 1] = b; tris[t * 3 + 2] = d;
      tris[t2 * 3] = b; tris[t2 * 3 + 1] = c; tris[t2 * 3 + 2] = d;
      index(t); index(t2);
      changed = true;
    }
    if (!changed) break;
  }
}

/** Every directed edge must appear exactly once with its reverse also present (closed 2-manifold). */
export function isClosedManifold(m: MeshLike): boolean {
  const t = m.triVerts;
  const edges = new Map<string, number>();
  for (let i = 0; i < t.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const key = `${t[i + k]},${t[i + ((k + 1) % 3)]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const [key, c] of edges) {
    if (c !== 1) return false;
    const [a, b] = key.split(',');
    if (edges.get(`${b},${a}`) !== 1) return false;
  }
  return true;
}
