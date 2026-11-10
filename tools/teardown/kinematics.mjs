import Module from 'manifold-3d';
import { readFileSync } from 'node:fs';
const w = await Module(); w.setup();
const { Manifold, Mesh } = w;
// load binary STL, merge vertices, split bodies by connectivity via manifold decompose
const buf = readFileSync(process.argv[2]); const dv = new DataView(buf.buffer, buf.byteOffset);
const n = dv.getUint32(80, true); const key = new Map(); const verts = []; const tris = [];
for (let i = 0; i < n; i++) { const o = 84 + 50 * i + 12; const t = [];
  for (let v = 0; v < 3; v++) { const x = dv.getFloat32(o + v*12, true), y = dv.getFloat32(o + v*12 + 4, true), z = dv.getFloat32(o + v*12 + 8, true);
    const k = `${x},${y},${z}`; let id = key.get(k); if (id === undefined) { id = verts.length / 3; key.set(k, id); verts.push(x, y, z); } t.push(id); }
  tris.push(...t); }
const mesh = new Mesh({ numProp: 3, vertProperties: new Float32Array(verts), triVerts: new Uint32Array(tris) });
mesh.merge();
const all = new Manifold(mesh);
const [b0, b1] = all.decompose();
const [base, arm] = b0.boundingBox().min[1] < b1.boundingBox().min[1] ? [b0, b1] : [b1, b0];
const AX = [-136.901, 7.688];
console.log('status', all.status(), 'base vol', base.volume().toFixed(1), 'arm vol', arm.volume().toFixed(1), 'minGap', base.minGap(arm, 3).toFixed(3));
const zones = { hinge: [-150, -131], div1: [-116, -108], div2: [-97, -86], end: [-86, -70] };
const box = (x0, x1) => Manifold.cube([x1 - x0, 100, 100]).translate([x0, -50, -50]);
for (const deg of [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 45, 60, 90, 120, 150, 170]) {
  const moved = arm.translate([-AX[0], -AX[1], 0]).rotate([0, 0, deg]).translate([AX[0], AX[1], 0]);
  const hit = Manifold.intersection(base, moved);
  const parts = Object.entries(zones).map(([k, [a, b]]) => `${k}=${Manifold.intersection(hit, box(a, b)).volume().toFixed(3)}`).join(' ');
  console.log(`${String(deg).padStart(5)}°  total ${hit.volume().toFixed(3).padStart(8)}  ${parts}`);
}
