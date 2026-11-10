import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import type { ClipParams } from '../params/schema.ts';
import { BRICK, type Derived } from '../rules/derive.ts';
import type { Scope } from './kernel.ts';

type Vec2 = [number, number];

/**
 * Builds the base and the arm in the PART FRAME (see derive.ts), clip closed.
 * The part frame is also the print frame: Z is up and the clip prints on its side.
 *
 * Method:
 *  - the base is profiles (XY) extruded across the width, plus a revolved hinge
 *    (middle knuckle, 45° cones, full-width pin)
 *  - the arm is a rough solid minus "the base grown by the clearance". That
 *    gives every running gap (grooves, bore, cone sockets, latch) exactly `c`
 *    without placing each one by hand.
 */
export function buildClip(K: ManifoldToplevel, S: Scope, p: ClipParams, d: Derived): { base: Manifold; arm: Manifold } {
  const { CrossSection: CS, Manifold: M } = K;
  const t = S.t;
  const eps = 0.01;
  // Curves are polygons, and chords sit inside the true circle. Cutting with a
  // little slack keeps every real gap ≥ the nominal clearance.
  const c = d.c + 0.015;

  /** Polygon from points in either winding. CrossSection drops clockwise contours, so flip them. */
  const poly = (pts: Vec2[]) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i]!, [x1, y1] = pts[(i + 1) % pts.length]!;
      a += x0 * y1 - x1 * y0;
    }
    return t(new CS([a < 0 ? [...pts].reverse() : pts]));
  };
  const rect = (x0: number, y0: number, x1: number, y1: number) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const circle = (cx: number, cy: number, r: number) => t(t(CS.circle(r)).translate([cx, cy]));
  const union = (xs: CrossSection[]) => t(CS.union(xs));
  // Explicit segment count: the global edge-length rule would give tiny radii (clearances) ~4 segments,
  // and those coarse arcs would cut inside the true clearance at corners.
  const grow = (cs: CrossSection, r: number) => t(cs.offset(r, 'Round', 2, 48));
  /** Morphological closing: fills inside corners with fillets of radius r. */
  const close = (cs: CrossSection, r: number) => (r > 0 ? t(grow(cs, r).offset(-r, 'Round')) : cs);
  const slab = (cs: CrossSection, z0: number, z1: number) => t(t(M.extrude(cs, z1 - z0)).translate([0, 0, z0]));

  const { tb, ya0, yTop, hy, Rb, Ra, div, post, tongue, finger } = d;

  // ================= BASE profile =================
  const plate = rect(d.xPlate0, 0, d.xEnd, tb);
  const stems = d.dividers.map((xc) => rect(xc - div.td / 2, tb - eps, xc + div.td / 2, div.domeC));
  const postBody = rect(post.x0, tb - eps, post.x1, post.domeC);
  const filleted = close(union([plate, ...stems, postBody]), Math.min(p.floorFillet, d.h / 3));

  const tops: CrossSection[] = [];
  for (const xc of d.dividers) {
    tops.push(circle(xc, div.domeC, div.domeR));
    if (div.rBall > 0) tops.push(circle(xc, div.yBall, div.rBall));
  }
  // Latch post: dome + ball like a divider, plus the hook head (flat ledge underneath, 45° ramp on top)
  tops.push(circle(post.xc, post.domeC, p.postThickness / 2));
  if (div.rBall > 0) tops.push(circle(post.xc, div.yBall, div.rBall));
  tops.push(poly([
    [post.x1 - 0.5, post.yLedge], [post.xh, post.yLedge], [post.xh, post.yLedge + post.hh],
    [post.x1 - 0.3, post.rampTopY], [post.x1 - 0.5, post.rampTopY],
  ]));
  const baseCore = union([filleted, ...tops]);

  // Middle zone: the barrel joins the plate through a filleted neck
  const barrel = circle(0, hy, Rb);
  const xN0 = Math.max(d.xPlate0, 0.6);
  const neck = close(union([barrel, rect(xN0, 0, Math.max(xN0 + 1, 0.8 * Rb), hy), rect(d.xPlate0, 0, d.xPlate0 + Rb, tb)]), 1.1);
  const baseMid = union([baseCore, neck]);
  // Arm zones: the plate stays clear of the arm knuckles
  const baseArm = t(baseCore.subtract(circle(0, hy, Ra + c)));

  // ================= ARM profile (rough) =================
  const armParts: CrossSection[] = [rect(d.xArm0, ya0, tongue.x1, yTop)];
  if (d.tab) {
    armParts.push(poly([
      [d.tab.x0 - eps, yTop], [d.tab.x1, yTop], [d.tab.x1, d.tab.yUnder1], [d.tab.x0 - eps, d.tab.yUnder0],
    ]));
  }
  // Latch tongue with a rounded U bottom, and the finger that hooks under the ledge
  const tt = tongue.x1 - tongue.x0;
  armParts.push(
    rect(tongue.x0, tongue.yU + tt / 2, tongue.x1, ya0 + eps),
    circle((tongue.x0 + tongue.x1) / 2, tongue.yU + tt / 2, tt / 2),
    poly([[tongue.x0 + eps, finger.yTop], [finger.tipX, finger.yTop], [finger.tipX, finger.yTop - 0.2], [tongue.x0 + eps, finger.yBottom]]),
  );
  // Lips flanking each divider top (concave flanks, pointed tips)
  const lips = (xc: number, side: 'both' | 'left') => {
    const rr = ya0 - div.yLip;
    const w = div.lipTip;
    let block = t(rect(xc - w - rr, div.yLip, xc + w + rr, ya0 + eps)
      .subtract(circle(xc - w - rr, div.yLip, rr)).subtract(circle(xc + w + rr, div.yLip, rr)));
    if (side === 'left') block = t(block.intersect(rect(xc - w - rr - 1, div.yLip - 1, xc, ya0 + 1)));
    return block;
  };
  for (const xc of d.dividers) armParts.push(lips(xc, 'both'));
  armParts.push(lips(post.xc, 'left'));
  const armCore = union(armParts);

  // Knuckle web: ring disc plus a column up into the plate
  // (the column starts ≥ 0.8 mm inside the ring so the two always fuse, even when the plate starts at the ring's edge)
  const colLeft = Math.min(d.xArm0, Ra - 0.8);
  const web = union([circle(0, hy, Ra), rect(colLeft, hy, Math.max(Ra, d.xArm0 + 0.5), yTop)]);
  const armMid = t(t(armCore.subtract(grow(baseMid, c))).subtract(circle(0, hy, Rb + d.cArc)));
  const armArm = t(union([armCore, web]).subtract(grow(baseArm, c)));

  // ================= 3D =================
  const baseSlabs: Manifold[] = [];
  const armSlabs: Manifold[] = [];
  for (const zn of d.zones) {
    if (zn.z1 - zn.z0 < 1e-6) continue;
    baseSlabs.push(slab(zn.kind === 'mid' ? baseMid : baseArm, zn.z0, zn.z1));
    armSlabs.push(slab(zn.kind === 'mid' ? armMid : armArm, zn.z0, zn.z1));
  }

  // Hinge solid of revolution, profile in (r, z)
  const z0 = d.zMid - d.Lb / 2, z1 = d.zMid + d.Lb / 2;
  const hinge2D = union([
    rect(0, -eps, d.rp, d.W + eps), // pin, full width
    poly([[0, z0 - d.Lc], [d.rCone, z0 - d.Lc], [Rb, z0], [Rb, z1], [d.rCone, z1 + d.Lc], [0, z1 + d.Lc]]),
  ]);
  let hingeClear = grow(hinge2D, c);
  if (d.gzL > c) {
    // vertical gaps (step faces) must be whole layers
    const dz = d.gzL - c;
    hingeClear = union([hingeClear, t(hingeClear.translate([0, dz])), t(hingeClear.translate([0, -dz]))]);
  }
  const revolve = (cs: CrossSection) => t(t(M.revolve(cs)).translate([0, hy, 0]));

  let base = t(M.union([...baseSlabs, revolve(hinge2D)]));
  let arm = t(t(M.union(armSlabs)).subtract(revolve(hingeClear)));
  // The middle zone's base (barrel neck and fillets) is wider than the arm-zone base. Keep arm material
  // just above and below the middle zone clear of it too, not only of the hinge solid.
  const zc = Math.max(c, d.gzL);
  arm = t(arm.subtract(slab(grow(baseMid, c), z0 - zc, z1 + zc)));

  // ================= Studs (arm top, pointing +Y, printed sideways) =================
  if (d.studGrid) {
    const s = d.stud;
    const body = t(M.cylinder(s.height - s.chamfer + eps, s.rRoot, s.rTip));
    const cham = t(t(M.cylinder(s.chamfer, s.rTip, s.rTop)).translate([0, 0, s.height - s.chamfer]));
    let one = t(t(body.add(cham)).rotate([-90, 0, 0])); // axis along +Y, root at y = 0
    if (s.undercut > 0) {
      // Flatten the side that faces down in the print (−Z) with a plane rising along the stud
      const cutter = t(t(t(M.cube([20, 40, 20])).translate([-10, -20, -20])).rotate([s.undercut, 0, 0]));
      one = t(one.subtract(t(cutter.translate([0, 0, -s.rRoot]))));
    }
    const studs: Manifold[] = [];
    for (const sx of d.studGrid.xs) for (const sz of d.studGrid.zs) studs.push(t(one.translate([sx, yTop - eps, sz])));
    arm = t(arm.add(t(M.union(studs))));
  }

  // ================= Pockets (base bottom, open at y = 0) =================
  if (d.pockets) {
    const { xs, zs, D, fit, depth } = d.pockets;
    const P = d.P;
    const u0 = xs[0]! - D / 2 - fit, u1 = xs[xs.length - 1]! + D / 2 + fit;
    const v0 = zs[0]! - D / 2 - fit, v1 = zs[zs.length - 1]! + D / 2 + fit;
    const keep: CrossSection[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const gx = (xs[i]! + xs[i + 1]!) / 2;
      if (i % 2 === 1) {
        keep.push(rect(gx - (P - D) / 2 + fit, v0 - 1, gx + (P - D) / 2 - fit, v1 + 1)); // rib across the width
      } else if (zs.length >= 2) {
        for (let j = 0; j < zs.length - 1; j++) keep.push(circle(gx, (zs[j]! + zs[j + 1]!) / 2, (P * Math.SQRT2 - D) / 2 - fit)); // tube
      } else {
        keep.push(circle(gx, zs[0]!, (P - D) / 2 - fit)); // 1-wide: pin between two studs
      }
    }
    for (let j = 0; j < zs.length - 1; j++) {
      const gz = (zs[j]! + zs[j + 1]!) / 2;
      keep.push(rect(u0 - 1, gz - BRICK.spineHalf, u1 + 1, gz + BRICK.spineHalf)); // spine along the clip
    }
    let cavity = rect(u0, v0, u1, v1);
    if (keep.length) cavity = t(cavity.subtract(union(keep)));
    cavity = t(t(cavity.offset(-0.8, 'Round')).offset(0.8, 'Round')); // round the pocket corners
    // (x, z) section -> extrude along +Y from y = −eps to depth
    const cut = t(t(t(M.extrude(cavity, depth + eps)).rotate([90, 0, 0])).translate([0, depth, 0]));
    base = t(base.subtract(cut));
  }

  // Keep everything inside the width
  const bounds = t(t(M.cube([1e4, 1e4, d.W])).translate([-5e3, -5e3, 0]));
  base = t(base.intersect(bounds));
  arm = t(arm.intersect(bounds));
  return { base, arm };
}
