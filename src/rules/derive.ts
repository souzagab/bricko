import type { ClipParams } from '../params/schema.ts';

/** Real-brick constants. These are what our sockets must accept, whatever the user sets for our studs. */
export const BRICK = {
  studDiameter: 4.8,
  studHeight: 1.7,
  play: 0.2, // a part n studs long measures n·pitch − 0.2
} as const;

export interface Issue {
  level: 'error' | 'warning' | 'info';
  param?: keyof ClipParams;
  message: string;
}

/**
 * Every coordinate the geometry needs, in the PART FRAME:
 *   X = along the clip (hinge axis at x = 0), Y = thickness (base bottom at y = 0),
 *   Z = width (0..W). The clip is modelled closed.
 */
export interface Derived {
  W: number;
  Rb: number; // barrel radius
  hy: number; // hinge axis height (barrel bottom touches y = 0)
  Rc: number; // cone pin base radius
  c: number; // radial / in-plane clearance
  ga: number; // knuckle gap along the hinge axis
  gz: number; // gap between wall tops and the arm underside
  segLen: number;
  segments: { z0: number; z1: number; owner: 'base' | 'arm' }[];
  tb: number;
  ta: number;
  h: number;
  ya0: number; // arm underside
  yTop: number; // arm top
  xs: number; // start wall left face
  walls: { x0: number; x1: number; keyed: boolean }[];
  channels: { x0: number; x1: number }[];
  xe: number; // end wall outer face
  /**
   * Latch wall ("skirt"): an arc band centred on the hinge axis, so opening slides
   * it past the end wall at constant clearance. The end wall's outer face is the
   * arc of radius R0 = xe.
   */
  skirt: { R0: number; rIn: number; rOut: number; xTop: number; xMin: number };
  catchX: number; // skirt inner face at the catch height
  catchY: number; // y of the catch tip
  catchDepth: number;
  catchRise: number;
  tab: number;
  key: number;
  armLeft: number;
  studGrid: { xs: number[]; zs: number[] } | null;
  studR: number;
  socketGrid: { xs: number[]; zs: number[] } | null;
  socketDepth: number;
  issues: Issue[];
}

const roundUpTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;

function grid(lo: number, hi: number, pitch: number): number[] {
  const n = Math.floor((hi - lo + BRICK.play) / pitch + 1e-9);
  if (n < 1) return [];
  const mid = (lo + hi) / 2;
  return Array.from({ length: n }, (_, i) => mid + (i - (n - 1) / 2) * pitch);
}

export function derive(p: ClipParams): Derived {
  const issues: Issue[] = [];
  const minWall = 2 * p.nozzle;
  const flat = p.orientation === 'flat';
  const twoLayers = 2 * p.layerHeight;

  // Width
  const W = p.widthMode === 'studs' ? p.studsAcross * p.studPitch - BRICK.play : p.freeWidth;

  // Clearances. Gaps along the print's Z axis must be whole layers.
  const c = p.radialClearance;
  if (c < 0.25) issues.push({ level: 'warning', param: 'radialClearance', message: 'Under 0.25 mm the hinge may fuse on many printers. Print the calibration piece first.' });
  const gz = flat ? roundUpTo(Math.max(c, twoLayers), p.layerHeight) : c;
  const ga = flat ? p.axialClearance : roundUpTo(Math.max(p.axialClearance, twoLayers), p.layerHeight);

  // Heights
  const tb = p.baseThickness;
  const ta = p.armThickness;
  const h = p.channelHeight;
  const ya0 = tb + h + gz;
  const yTop = ya0 + ta;

  // Barrel: the arm plate passes over the base knuckles, so barrel top + clearance must stay under the arm
  let Rb = p.barrelDiameter / 2;
  const maxRb = (ya0 - c - 0.01) / 2;
  if (Rb > maxRb) {
    Rb = maxRb;
    issues.push({ level: 'info', param: 'barrelDiameter', message: `Barrel clamped to Ø${(2 * Rb).toFixed(1)} mm to fit under the arm.` });
  }
  const hy = Rb;

  // Knuckle segments along the width
  const K = p.knuckles;
  const segLen = (W - (K - 1) * ga) / K;
  if (segLen < 2 * minWall) {
    issues.push({ level: 'error', param: 'knuckles', message: 'Too many knuckles for this width.' });
  }
  const segments = Array.from({ length: K }, (_, k) => ({
    z0: k * (segLen + ga),
    z1: k * (segLen + ga) + segLen,
    owner: (k % 2 === 0 ? 'base' : 'arm') as 'base' | 'arm',
  }));

  // Cone pin: must leave a wall around its socket and fit in the next knuckle
  let Rc = p.coneDiameter / 2;
  const socketExtra = c * Math.SQRT2 - ga; // socket radius at the face = Rc + socketExtra
  const maxRc = Math.min(Rb - minWall - Math.max(0, socketExtra), segLen - minWall - socketExtra);
  if (Rc > maxRc) {
    Rc = Math.max(0.5, maxRc);
    issues.push({ level: 'info', param: 'coneDiameter', message: `Cone pin clamped to Ø${(2 * Rc).toFixed(1)} mm to fit the barrel.` });
  }
  if (maxRc < 0.8) issues.push({ level: 'error', param: 'barrelDiameter', message: 'Barrel too small for a print-in-place pin.' });

  // Walls and channels along X
  const widths = p.channelWidths && p.channelWidths.length === p.channelCount
    ? p.channelWidths
    : Array.from({ length: p.channelCount }, () => p.channelWidth);
  if (p.channelWidths && p.channelWidths.length !== p.channelCount) {
    issues.push({ level: 'warning', param: 'channelWidths', message: 'Per-channel widths ignored: count does not match.' });
  }
  const td = p.dividerThickness;
  const key = Math.min(p.keyDepth, (td - 0.4) / 2, ta - minWall);
  const xs = Rb + c;
  const arcX = (r: number, y: number) => Math.sqrt(Math.max(0, r * r - (y - hy) ** 2));

  // Catch height (independent of length)
  const catchDepth = p.catchDepth;
  const catchRise = catchDepth * Math.tan((p.catchAngle * Math.PI) / 180);
  const wallTop = tb + h;
  const lo = catchDepth + p.elephantFoot + 0.6;
  const hi = wallTop - catchRise - 0.6;
  const catchY = Math.min(Math.max(wallTop / 2, lo), hi);
  if (hi < lo) issues.push({ level: 'error', param: 'channelHeight', message: 'Clip too short for the latch catch. Raise channel height or lower catch depth.' });

  // Lay out walls and channels. The end wall's outer face is an arc about the hinge,
  // so on short clips it dips at the catch. Grow the end wall until the notch leaves ≥ minWall.
  const layout = (te: number) => {
    const walls: Derived['walls'] = [];
    const channels: Derived['channels'] = [];
    let x = xs;
    walls.push({ x0: x, x1: x + td, keyed: false });
    x += td;
    widths.forEach((w, i) => {
      channels.push({ x0: x, x1: x + w });
      x += w;
      const t = i === widths.length - 1 ? te : td;
      walls.push({ x0: x, x1: x + t, keyed: false });
      x += t;
    });
    const xe = x;
    const catchX = arcX(xe + c, catchY);
    const left = catchX - catchDepth - c - (xe - te); // wall left behind the notch
    return { walls, channels, xe, catchX, left };
  };
  let te = Math.max(p.endWallThickness, catchDepth + c + minWall);
  let L = layout(te);
  for (let i = 0; i < 6 && L.left < minWall - 1e-6; i++) {
    te += minWall - L.left + 0.01;
    L = layout(te);
  }
  if (te > p.endWallThickness + 1e-6) issues.push({ level: 'info', param: 'endWallThickness', message: `End wall thickened to ${te.toFixed(1)} mm to fit the catch.` });
  const { walls, channels, xe, catchX } = L;

  // Latch skirt: an arc band about the hinge axis
  const rIn = xe + c;

  // A key only works where the arm lifts more than it slides sideways while opening.
  // Arm motion at (x, y) is ∝ (hy − y, x). The 45° key sides need x ≥ y − hy.
  // Only dividers get keys: the end wall is aligned by the latch. Skip any key whose
  // groove would reach the latch arc, which leans over the last dividers on tall clips.
  const yKey = tb + h + key;
  const arcAtGroove = arcX(rIn, yKey + gz + c);
  walls.forEach((wall, i) => {
    const divider = i > 0 && i < walls.length - 1;
    wall.keyed = divider && key > 0 && wall.x1 >= yKey - hy + 0.5 && wall.x1 + c + 0.5 < arcAtGroove;
  });

  const rOut = rIn + p.skirtThickness;
  const skirt = { R0: xe, rIn, rOut, xTop: arcX(rOut, yTop), xMin: xe - te };
  // The arc must reach the arm top at ≤ 45° from vertical. Otherwise the latch wall
  // overhangs (flat) and can't swing clear of the walls (either orientation).
  if (yTop - hy > rIn * Math.SQRT1_2) {
    issues.push({ level: 'error', param: 'channelHeight', message: 'Clip too tall for its length: the latch cannot swing clear. Widen the channels or lower the height.' });
  }

  // Thumb tab: its 45° underside must stay above the bed
  const tab = Math.max(0, Math.min(p.tabLength, yTop - Math.min(1.2, ta)));
  if (tab < p.tabLength) issues.push({ level: 'info', param: 'tabLength', message: `Thumb tab shortened to ${tab.toFixed(1)} mm to stay above the bed.` });

  // Bridges in flat orientation
  if (flat) {
    const widest = Math.max(...widths);
    if (widest > 35) issues.push({ level: 'warning', param: 'channelWidth', message: `${widest} mm channel roof is a long bridge in flat orientation.` });
  }

  // Thin walls
  for (const [k, v] of [['dividerThickness', td], ['skirtThickness', p.skirtThickness], ['armThickness', ta]] as const) {
    if (v < minWall) issues.push({ level: 'warning', param: k, message: `Under 2 × nozzle (${minWall.toFixed(1)} mm).` });
  }

  // Studs on the arm top
  const armLeft = -Rb;
  const zMid = W / 2;
  const acrossGrid = (span: number) => grid(zMid - span / 2, zMid + span / 2, p.studPitch);
  const studGrid = p.studsOn
    ? { xs: grid(armLeft, skirt.xTop, p.studPitch), zs: acrossGrid(W) }
    : null;
  const studR = (p.studDiameter + p.studFit) / 2;

  // Sockets in the base bottom (between the hinge zone and the end wall)
  let socketGrid: Derived['socketGrid'] = null;
  const wantDepth = BRICK.studHeight + 0.2;
  const socketDepth = Math.min(wantDepth, tb - minWall);
  if (p.bottomMode !== 'flat') {
    socketGrid = { xs: grid(xs, xe, p.studPitch), zs: acrossGrid(W) };
    if (socketDepth < BRICK.studHeight) {
      issues.push({ level: 'warning', param: 'baseThickness', message: `Base too thin: bricks will not seat fully (needs ≥ ${(wantDepth + minWall).toFixed(1)} mm).` });
    }
    if (socketGrid.xs.length === 0 || socketGrid.zs.length === 0) socketGrid = null;
  }

  return {
    W, Rb, hy, Rc, c, ga, gz, segLen, segments, tb, ta, h, ya0, yTop, xs, walls, channels, xe,
    skirt, catchX, catchY, catchDepth, catchRise, tab, key, armLeft, studGrid, studR,
    socketGrid, socketDepth, issues,
  };
}
