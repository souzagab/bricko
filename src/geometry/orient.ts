import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { ClipParams } from '../params/schema.ts';
import type { Scope } from './kernel.ts';

/**
 * Part frame -> bed frame. The clip prints on its side, so the part frame
 * already has Z up (hinge axis vertical). Centre on XY, put z min at 0 and
 * apply the first-layer inset.
 */
export function toBed(K: ManifoldToplevel, S: Scope, p: ClipParams, bodies: { base: Manifold; arm: Manifold }) {
  const t = S.t;
  let { base, arm } = bodies;
  const both = t(K.Manifold.compose([base, arm]));
  const bb = both.boundingBox();
  const shift: [number, number, number] = [
    -(bb.min[0] + bb.max[0]) / 2,
    -(bb.min[1] + bb.max[1]) / 2,
    -bb.min[2],
  ];
  base = t(base.translate(shift));
  arm = t(arm.translate(shift));

  if (p.elephantFoot > 0) {
    base = firstLayerInset(K, S, base, p.layerHeight, p.elephantFoot);
    arm = firstLayerInset(K, S, arm, p.layerHeight, p.elephantFoot);
  }
  // Collapse sub-micron sliver triangles left by booleans so strict mesh tools see a clean, watertight mesh
  base = dropSlivers(K, S, t(base.simplify(1e-4)));
  arm = dropSlivers(K, S, t(arm.simplify(1e-4)));
  return { base, arm, shift };
}

/**
 * Replaces the first layer with a copy of its outline shrunk by `inset`. The
 * squished first layer (elephant foot) then cannot weld two bodies together.
 */
function firstLayerInset(K: ManifoldToplevel, S: Scope, body: Manifold, layer: number, inset: number): Manifold {
  const t = S.t;
  const { Manifold: M } = K;
  const big = 1e4;
  const below = t(t(M.cube([big, big, layer])).translate([-big / 2, -big / 2, 0]));
  const upper = t(body.subtract(below));
  // Use what the body covers at BOTH ends of the first layer, so the prism never
  // pokes out where a curved surface (hinge cut-back) narrows the body.
  const footprint = t(t(body.slice(layer * 0.05)).intersect(t(body.slice(layer * 0.999))));
  const raw = t(footprint.offset(-inset, 'Miter', 2));
  // Offsetting thin rings can leave zero-area slivers. Keep only real islands.
  const islands = raw.decompose().map(t).filter((cs) => cs.area() > 0.01);
  if (islands.length === 0) return upper;
  const lower = t(M.extrude(t(K.CrossSection.compose(islands)), layer + 0.001));
  return dropSlivers(K, S, t(upper.add(lower)));
}

/** Removes zero-volume leftovers that booleans can produce. */
export function dropSlivers(K: ManifoldToplevel, S: Scope, m: Manifold): Manifold {
  const parts = m.decompose().map(S.t);
  const real = parts.filter((x) => x.volume() > 1e-3);
  return real.length === parts.length ? m : S.t(K.Manifold.compose(real));
}
