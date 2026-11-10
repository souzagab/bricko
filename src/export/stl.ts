/** Minimal mesh shape: what Manifold.getMesh() returns. */
export interface MeshLike {
  numProp: number;
  vertProperties: Float32Array;
  triVerts: Uint32Array;
}

/** Binary STL from one or more meshes, which become one file with several bodies. */
export function toBinaryStl(meshes: MeshLike[], header = 'Bricko cable clip'): Uint8Array {
  const triCount = meshes.reduce((n, m) => n + m.triVerts.length / 3, 0);
  const buf = new ArrayBuffer(84 + 50 * triCount);
  const dv = new DataView(buf);
  const head = new TextEncoder().encode(header.slice(0, 80));
  new Uint8Array(buf, 0, 80).set(head);
  dv.setUint32(80, triCount, true);
  let o = 84;
  for (const { numProp, vertProperties: v, triVerts } of meshes) {
    for (let i = 0; i < triVerts.length; i += 3) {
      const a = triVerts[i]! * numProp, b = triVerts[i + 1]! * numProp, c = triVerts[i + 2]! * numProp;
      const ax = v[a]!, ay = v[a + 1]!, az = v[a + 2]!;
      const bx = v[b]!, by = v[b + 1]!, bz = v[b + 2]!;
      const cx = v[c]!, cy = v[c + 1]!, cz = v[c + 2]!;
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const wx = cx - ax, wy = cy - ay, wz = cz - az;
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      for (const f of [nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz]) {
        dv.setFloat32(o, f, true);
        o += 4;
      }
      dv.setUint16(o, 0, true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}
