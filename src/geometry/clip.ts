import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import type { ClipParams } from '../params/schema.ts';
import { BRICK, type Derived } from '../rules/derive.ts';
import type { Scope } from './kernel.ts';

type Vec2 = [number, number];

/**
 * Builds the two bodies in the PART FRAME (see derive.ts), clip closed.
 *
 * Hinge: knuckles alternate across the width, starting and ending with the base.
 * Between neighbours, the lower-z knuckle carries a 45° male cone that sits in a
 * socket in the next knuckle. 45° prints in both orientations, and no separate
 * pin bridges a gap.
 */
export function buildClip(K: ManifoldToplevel, S: Scope, p: ClipParams, d: Derived): { base: Manifold; arm: Manifold } {
  const { CrossSection: CS, Manifold: M } = K;
  const t = S.t;
  /** Polygon from points in either winding. CrossSection drops clockwise contours, so flip them. */
  const poly = (pts: Vec2[]) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i]!, [x1, y1] = pts[(i + 1) % pts.length]!;
      a += x0 * y1 - x1 * y0;
    }
    return t(new CS([a < 0 ? [...pts].reverse() : pts]));
  };
  const rect = (x0: number, y0: number, x1: number, y1: number) =>
    poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const circle = (cx: number, cy: number, r: number) => t(t(CS.circle(r)).translate([cx, cy]));
  const union = (xs: CrossSection[]) => t(CS.union(xs));
  /** Extrude a profile over z0..z1. */
  const slab = (cs: CrossSection, z0: number, z1: number) => t(t(M.extrude(cs, z1 - z0)).translate([0, 0, z0]));

  const { Rb, hy, tb, h, ya0, yTop, xe, skirt, W } = d;

  const eps = 0.01;
  // Curves are polygons, and chords sit inside the true circle. Cutting with a
  // little slack keeps every real gap ≥ the nominal clearance.
  const c = d.c + 0.01;

  // ---------- 2D profiles ----------
  const wallTop = tb + h;

  // Key on top of a wall: a trapezoid with 45° sides, rising `key` above the wall.
  const keyShape = (x0: number, x1: number) =>
    poly([[x0, wallTop - eps], [x1, wallTop - eps], [x1 - d.key, wallTop + d.key], [x0 + d.key, wallTop + d.key]]);

  // Catch bump on the skirt's inner face: 45° underside, `catchAngle` top face.
  // Its back edge sits 0.3 mm inside the skirt so it fuses even though the face is an arc.
  const cx = d.catchX;
  const bump: Vec2[] = [
    [cx + 0.3, d.catchY - d.catchDepth - 0.3],
    [cx, d.catchY - d.catchDepth],
    [cx - d.catchDepth, d.catchY],
    [cx, d.catchY + d.catchRise],
    [cx + 0.3, d.catchY + d.catchRise],
  ];
  // Arcs about the hinge axis (rotation keeps their spacing constant)
  const arcDisc = (r: number) => circle(0, hy, r);

  // Base core: plate + walls (+ keys), minus the catch notch
  const baseParts: CrossSection[] = [rect(0, 0, xe, tb)];
  for (const w of d.walls) {
    baseParts.push(rect(w.x0, tb - eps, w.x1, wallTop));
    if (w.keyed) baseParts.push(keyShape(w.x0, w.x1));
  }
  const notch = t(poly(bump).offset(c, 'Miter', 4));
  // Divider snaps: fork head on the base, bulb + neck on the arm
  const snapCuts: CrossSection[] = [];
  const armSnaps: CrossSection[] = [];
  for (const s of d.snaps) {
    const { xc, yb, rb, sw, fb, yBottom } = s;
    const bulb = poly([
      [xc - fb / 2, yBottom], [xc + fb / 2, yBottom], [xc + rb, yb],
      [xc + sw / 2, yb + rb - sw / 2], [xc - sw / 2, yb + rb - sw / 2], [xc - rb, yb],
    ]);
    const neck = rect(xc - sw / 2, yb, xc + sw / 2, ya0 + eps);
    armSnaps.push(bulb, neck);
    baseParts.push(poly([
      [xc - (s.wf / 2 - s.flare) - eps, s.yHead - s.flare - eps], [xc + (s.wf / 2 - s.flare) + eps, s.yHead - s.flare - eps],
      [xc + s.wf / 2, s.yHead], [xc + s.wf / 2, wallTop], [xc - s.wf / 2, wallTop], [xc - s.wf / 2, s.yHead],
    ]));
    const around = t(bulb.offset(c, 'Miter', 4));
    const below = d.gz > c && p.orientation === 'flat' ? d.gz : c; // whole layers under the bulb when flat
    snapCuts.push(
      t(CS.hull([around, t(around.translate([0, -(below - c)]))])),
      rect(xc - sw / 2 - c, yb, xc + sw / 2 + c, wallTop + 1),
      rect(xc - s.ws / 2, s.ySlot, xc + s.ws / 2, yBottom - below + eps),
    );
  }
  let baseCore = t(t(t(union(baseParts)).intersect(arcDisc(skirt.R0))).subtract(notch));
  if (snapCuts.length) baseCore = t(baseCore.subtract(union(snapCuts)));

  // Arm core: plate (extends over the barrel) + skirt + bump + tab, minus key grooves
  const armParts: CrossSection[] = [
    rect(d.armLeft, ya0, skirt.xTop, yTop),
    // skirt = arc band between rIn and rOut (x > 0, bed to top). It never enters the base, which is clipped to R0.
    t(t(arcDisc(skirt.rOut).subtract(arcDisc(skirt.rIn))).intersect(rect(0, 0, skirt.rOut + 1, yTop))),
    poly(bump),
  ];
  if (d.tab > 0) {
    const tip = Math.min(1.2, d.ta);
    const wedge = poly([
      [skirt.xTop - 0.3, yTop], [skirt.xTop + d.tab, yTop],
      [skirt.xTop + d.tab, yTop - tip], [skirt.xTop - 0.3, yTop - tip - d.tab - 0.3],
    ]);
    armParts.push(t(wedge.subtract(arcDisc(skirt.rIn))));
  }
  let armCore = union([...armParts, ...armSnaps]);
  for (const w of d.walls) {
    if (!w.keyed) continue;
    const g = t(keyShape(w.x0, w.x1).offset(c, 'Miter', 4));
    // Keep the gap above the key at least gz (whole layers in flat orientation)
    const groove = t(CS.hull([g, t(g.translate([0, d.gz - c]))]));
    armCore = t(armCore.subtract(groove));
  }

  // Hinge 2D: knuckle disc, and the arm web joining its knuckle to the plate
  const disc = circle(0, hy, Rb);
  const armWeb = t(CS.hull([disc, rect(0, ya0, Rb, yTop)]));
  const baseInBaseSeg = union([baseCore, disc]);
  const baseElsewhere = t(baseCore.subtract(t(union([armWeb, disc]).offset(c, 'Round'))));
  const armInArmSeg = union([armCore, armWeb]);
  const armElsewhere = t(armCore.subtract(circle(0, hy, Rb + c)));

  // ---------- 3D: profiles along the width ----------
  const baseSlabs: Manifold[] = [];
  const armSlabs: Manifold[] = [];
  let z = 0;
  for (const seg of d.segments) {
    // gap before this segment (both bodies cut back near the axis)
    if (seg.z0 > z) {
      baseSlabs.push(slab(baseElsewhere, z - eps, seg.z0 + eps));
      armSlabs.push(slab(armElsewhere, z - eps, seg.z0 + eps));
    }
    const own = seg.owner === 'base';
    baseSlabs.push(slab(own ? baseInBaseSeg : baseElsewhere, seg.z0, seg.z1));
    armSlabs.push(slab(own ? armElsewhere : armInArmSeg, seg.z0, seg.z1));
    z = seg.z1;
  }
  let base = t(M.union(baseSlabs));
  let arm = t(M.union(armSlabs));

  // Cone pins and sockets
  const cone = (zBase: number, r: number) =>
    t(t(M.cylinder(r, r, 0)).translate([0, hy, zBase]));
  for (let k = 0; k < d.segments.length - 1; k++) {
    const lower = d.segments[k]!;
    const upper = d.segments[k + 1]!;
    const male = cone(lower.z1 - eps, d.Rc + eps);
    // Socket = male cone shifted along the axis by c·√2, which is a c offset normal to a 45° surface
    const apex = lower.z1 + d.Rc + c * Math.SQRT2;
    const r0 = apex - (upper.z0 - eps);
    const socket = cone(upper.z0 - eps, r0);
    if (lower.owner === 'base') {
      base = t(base.add(male));
      arm = t(arm.subtract(socket));
    } else {
      arm = t(arm.add(male));
      base = t(base.subtract(socket));
    }
  }

  // ---------- Bricks ----------
  // Studs on the arm top (cylinders along +Y)
  if (d.studGrid) {
    const studs: Manifold[] = [];
    for (const sx of d.studGrid.xs) for (const sz of d.studGrid.zs) {
      studs.push(t(t(t(M.cylinder(p.studHeight + eps, d.studR)).rotate([-90, 0, 0])).translate([sx, yTop - eps, sz])));
    }
    arm = t(arm.add(t(M.union(studs))));
  }

  // Sockets in the base bottom, open at y = 0
  if (d.socketGrid && p.bottomMode !== 'flat') {
    const { xs, zs } = d.socketGrid;
    const fit = p.socketFit;
    const D = BRICK.studDiameter;
    const P = p.studPitch;
    const depth = d.socketDepth + eps;
    // Box in part coords (x, z footprint), from y = -eps up to `depth`
    const boxY = (x0: number, x1: number, z0: number, z1: number) =>
      t(t(M.cube([x1 - x0, depth + eps, z1 - z0])).translate([x0, -eps, z0]));
    const postY = (x: number, zc: number, r: number, rIn = 0) => {
      let post = t(t(t(M.cylinder(depth + eps, r)).rotate([-90, 0, 0])).translate([x, -eps, zc]));
      if (rIn > 0) post = t(post.subtract(t(t(t(M.cylinder(depth + 3 * eps, rIn)).rotate([-90, 0, 0])).translate([x, -2 * eps, zc]))));
      return post;
    };
    let cut: Manifold;
    if (p.bottomMode === 'cavity') {
      const half = D / 2 + fit;
      const x0 = xs[0]! - half, x1 = xs[xs.length - 1]! + half;
      const z0 = zs[0]! - half, z1 = zs[zs.length - 1]! + half;
      cut = boxY(x0, x1, z0, z1);
      // Tubes touch 4 diagonal studs; 1-wide parts get pins between 2 studs
      const posts: Manifold[] = [];
      if (zs.length >= 2) {
        const rOut = (P * Math.SQRT2 - D) / 2 - fit;
        for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
          posts.push(postY((xs[i]! + xs[i + 1]!) / 2, (zs[j]! + zs[j + 1]!) / 2, rOut, D / 2));
        }
      } else {
        const r = (P - D) / 2 - fit;
        for (let i = 0; i < xs.length - 1; i++) posts.push(postY((xs[i]! + xs[i + 1]!) / 2, zs[0]!, r));
      }
      if (posts.length) cut = t(cut.subtract(t(M.union(posts))));
    } else {
      const holes: Manifold[] = [];
      for (const x of xs) for (const zc of zs) holes.push(postY(x, zc, D / 2 + fit));
      cut = t(M.union(holes));
    }
    base = t(base.subtract(cut));
  }

  // Clip both bodies to the width and to y ≥ 0 (the bed in flat orientation)
  const bounds = t(t(M.cube([1e4, 1e4, W])).translate([-5e3, 0, 0]));
  base = t(base.intersect(bounds));
  arm = t(arm.intersect(bounds));
  return { base, arm };
}
