import type { ClipParams } from '../params/schema.ts';

/** Real-brick constants: what our pockets must accept, whatever the user sets for our studs. */
export const BRICK = { studDiameter: 4.8, spineHalf: 0.95 } as const;

export interface Issue {
  level: 'error' | 'warning' | 'info';
  param?: keyof ClipParams;
  message: string;
}

export type Zone = { kind: 'arm' | 'mid'; z0: number; z1: number };

/**
 * All dimensions in the PART FRAME, which is also the print frame (the clip
 * prints on its side):
 *   X along the clip, hinge axis at x = 0
 *   Y thickness, socket face at y = 0, hinge axis at y = hy
 *   Z width 0..W, which is the print's vertical axis
 * The clip is modelled closed.
 */
export interface Derived {
  W: number; P: number; play: number; minWall: number;
  c: number; // clearance between moving parts
  cArc: number; // arm underside around the barrel, and tongue-to-hook gap
  gzL: number; // axial (vertical) hinge gaps, whole layers
  tb: number; ta: number; h: number; ya0: number; yTop: number; hy: number;
  // hinge
  Rb: number; Ra: number; rp: number; rCone: number; Lc: number; Lb: number; zMid: number;
  zones: Zone[];
  // along X
  xPlate0: number; xArm0: number; xEnd: number;
  channels: { x0: number; x1: number }[];
  dividers: number[]; // centre x
  div: { td: number; rBall: number; yBall: number; domeR: number; domeC: number; yLip: number; lipTip: number; snap: boolean; grip: number };
  post: { x0: number; x1: number; xc: number; xh: number; yLedge: number; hh: number; rampTopY: number; domeC: number };
  tongue: { x0: number; x1: number; yU: number };
  finger: { yTop: number; tipX: number; yBottom: number };
  tab: { x0: number; x1: number; yUnder0: number; yUnder1: number } | null;
  studGrid: { xs: number[]; zs: number[] } | null;
  stud: { rRoot: number; rTip: number; rTop: number; height: number; chamfer: number; undercut: number };
  pockets: { xs: number[]; zs: number[]; D: number; fit: number; depth: number } | null;
  issues: Issue[];
}

const roundUpTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;

/** n centres at `pitch`, centred on [lo, hi], fitting n·pitch − play ≤ hi − lo. */
function grid(lo: number, hi: number, pitch: number, play: number): number[] {
  const n = Math.floor((hi - lo + play) / pitch + 1e-6);
  if (n < 1) return [];
  const mid = (lo + hi) / 2;
  return Array.from({ length: n }, (_, i) => mid + (i - (n - 1) / 2) * pitch);
}

export function derive(p: ClipParams): Derived {
  const issues: Issue[] = [];
  const info = (param: keyof ClipParams, message: string) => issues.push({ level: 'info', param, message });
  const P = p.studPitch;
  const play = p.brickPlay;
  const minWall = 2 * p.nozzle;
  const W = p.studsAcross * P - play;
  const zMid = W / 2;

  // Clearances
  const c = p.clearance;
  const cArc = c + 0.1;
  const gzL = roundUpTo(Math.max(c, p.layerHeight), p.layerHeight);
  if (c < 0.2) issues.push({ level: 'warning', param: 'clearance', message: 'Under 0.2 mm the hinge may fuse on many printers. Print the test piece first.' });

  // Heights
  const tb = p.baseThickness;
  const ta = p.armThickness;
  const h = p.channelHeight;
  const ya0 = tb + h;
  const yTop = ya0 + ta;
  const hy = yTop / 2;

  // Hinge radii
  let Rb = p.barrelDiameter / 2;
  const maxRb = Math.min(yTop - hy - cArc - minWall, hy - 0.2);
  if (Rb > maxRb) { Rb = maxRb; info('barrelDiameter', `Barrel clamped to Ø${(2 * Rb).toFixed(2)} mm to fit the clip height.`); }
  const Ra = Rb;
  let rp = p.pinDiameter / 2;
  const maxRp = Ra - c - minWall;
  if (rp > maxRp) { rp = maxRp; info('pinDiameter', `Pin clamped to Ø${(2 * rp).toFixed(2)} mm to leave a wall around it.`); }
  if (rp < 0.8) issues.push({ level: 'error', param: 'barrelDiameter', message: 'Barrel too small for a pin.' });
  const step = Math.max(0, Math.min(p.coneStep, Rb - 0.3 - rp));
  const rCone = rp + step;
  const Lc = Rb - rCone; // 45° cone length

  // Knuckle lengths along Z: arm | base middle | arm
  const armMin = 1.5;
  const maxLb = W - 2 * (Lc + gzL + armMin);
  let Lb = p.middleKnuckle;
  if (maxLb < 1.2) issues.push({ level: 'error', param: 'studsAcross', message: 'Clip too narrow for the hinge. Use a wider clip or a smaller barrel.' });
  if (Lb > maxLb) { Lb = Math.max(1.2, maxLb); info('middleKnuckle', `Middle knuckle shortened to ${Lb.toFixed(1)} mm.`); }
  const zones: Zone[] = [
    { kind: 'arm', z0: 0, z1: zMid - Lb / 2 },
    { kind: 'mid', z0: zMid - Lb / 2, z1: zMid + Lb / 2 },
    { kind: 'arm', z0: zMid + Lb / 2, z1: W },
  ];

  // Base plate starts where it clears the arm knuckles
  const xPlate0 = Math.sqrt(Math.max(0, (Ra + c + 0.05) ** 2 - (hy - tb) ** 2));
  const xArm0 = xPlate0;

  // ---- Latch (vertical layout first: it limits the hook size) ----
  const yLedge = tb + 0.6 * h;
  const hh = Math.min(0.85, 0.1 * h);
  let hookOver = p.hookOverhang;
  const rampLimit = ya0 - c - 0.2;
  const maxHook = rampLimit - (yLedge + hh) - 0.3;
  if (hookOver > maxHook) { hookOver = maxHook; info('hookOverhang', `Hook shortened to ${Math.max(0, hookOver).toFixed(2)} mm to fit the channel height.`); }
  const overlap = Math.min(p.catchOverlap, hookOver - 0.3);
  if (overlap < p.catchOverlap) info('catchOverlap', `Catch overlap reduced to ${Math.max(0, overlap).toFixed(2)} mm.`);
  if (hookOver < 0.8 || overlap < 0.3) issues.push({ level: 'error', param: 'channelHeight', message: 'Channels too short for the latch hook. Raise the channel height.' });
  const rampTopY = yLedge + hh + hookOver + 0.3;
  const tt = p.tongueThickness;
  const yU = Math.max(tb + 0.26 * h, tb + c + 0.3);

  // ---- Dividers (mushroom keys) ----
  const td = p.dividerThickness;
  const domeR = td / 2;
  const domeC = ya0 - 0.1 - domeR;
  let rBall = p.ballDiameter / 2;
  // A ball may narrow each neighbouring channel mouth by at most 25 %
  const narrowest = Math.min(...(p.channelWidths && p.channelWidths.length === p.channelCount ? p.channelWidths : [p.channelWidth]));
  const maxBall = domeR + 0.25 * narrowest;
  if (rBall > maxBall) { rBall = maxBall; info('ballDiameter', `Ball reduced to Ø${(2 * rBall).toFixed(2)} mm to keep the channel mouths open.`); }
  if (rBall > 0 && rBall < domeR + 0.1) { rBall = 0; info('ballDiameter', 'Ball smaller than the divider: using a straight divider.'); }
  let yBall = rBall > 0 ? domeC - Math.max(rBall * 0.91, domeR + 0.3) : domeC;
  if (rBall > 0 && yBall - rBall < tb + 0.5) {
    yBall = tb + 0.5 + rBall;
    if (yBall > domeC) { rBall = 0; yBall = domeC; info('ballDiameter', 'Channels too short for divider balls.'); }
  }
  const snap = p.dividerSnap && rBall > 0;
  if (p.dividerSnap && !snap) info('dividerSnap', 'Snap dividers need a ball. Using keys.');
  let yLip: number, lipTip: number, grip = 0;
  if (snap) {
    yLip = Math.max(yBall - p.snapDepth, tb + 1);
    const inner = Math.max(Math.sqrt(Math.max(0, (rBall + c) ** 2 - (yBall - yLip) ** 2)), domeR + c);
    grip = rBall - inner;
    lipTip = inner + Math.max(0.6, 0.75 * minWall);
    if (grip < 0.1) issues.push({ level: 'warning', param: 'snapDepth', message: 'Snap too shallow to click. Increase snap depth or ball size.' });
  } else {
    yLip = rBall > 0 ? yBall + rBall * 0.72 : domeC;
    lipTip = (rBall > 0 ? rBall : domeR) + c;
  }

  // ---- Along X ----
  const widths = p.channelWidths && p.channelWidths.length === p.channelCount
    ? p.channelWidths
    : Array.from({ length: p.channelCount }, () => p.channelWidth);
  if (p.channelWidths && p.channelWidths.length !== p.channelCount) {
    issues.push({ level: 'warning', param: 'channelWidths', message: 'Per-channel widths ignored: count does not match.' });
  }
  const layout = (extra: number) => {
    const channels: Derived['channels'] = [];
    const dividers: number[] = [];
    let x = Rb; // first channel starts at the barrel
    widths.forEach((w, i) => {
      channels.push({ x0: x, x1: x + w + extra });
      x += w + extra;
      if (i < widths.length - 1) { dividers.push(x + td / 2); x += td; }
    });
    const x0 = x, x1 = x0 + p.postThickness, xh = x1 + hookOver;
    const t0 = xh + cArc, t1 = t0 + tt;
    return { channels, dividers, post: { x0, x1, xh }, t0, t1, xEnd: t1 + p.tabLength };
  };
  let L = layout(0);
  if (p.snapLength) {
    // Nearest whole stud, unless that would squeeze a channel below 3 mm
    const Lp = L.xEnd - xPlate0;
    let n = Math.max(1, Math.round((Lp + play) / P));
    if (Math.min(...widths) + (n * P - play - Lp) / widths.length < 3) n = Math.ceil((Lp + play) / P - 1e-9);
    L = layout((n * P - play - Lp) / widths.length);
  }
  const { channels, dividers, xEnd } = L;
  const post = {
    ...L.post, xc: (L.post.x0 + L.post.x1) / 2, yLedge, hh, rampTopY,
    domeC: ya0 - 0.1 - p.postThickness / 2,
  };
  const tongue = { x0: L.t0, x1: L.t1, yU };
  const fingerTop = yLedge - c - 0.015; // same slack as the cuts in clip.ts
  const tipX = post.xh - overlap;
  const yBottom = Math.max(fingerTop - 0.2 - (tongue.x0 - tipX) * 1.6, yU + tt / 2 + 0.3);
  const finger = { yTop: fingerTop, tipX, yBottom };
  const tab = p.tabLength > 0
    ? { x0: tongue.x1, x1: xEnd, yUnder0: yTop - 0.74 * ta, yUnder1: yTop - 0.31 * ta }
    : null;

  // Dividers too close to the hinge can't lift straight off their key
  for (const xc of dividers) {
    if (xc < 2 * (yLip - hy) + Rb) issues.push({ level: 'warning', message: `Divider at ${xc.toFixed(1)} mm is close to the hinge and may rub when opening.` });
  }

  // ---- Studs ----
  const zs = grid(0, W, P, play);
  const xsTop = grid(xArm0, xEnd, P, play);
  const studGrid = p.studsOn && xsTop.length ? { xs: xsTop, zs } : null;
  const dS = p.studDiameter + p.studFit;
  const stud = {
    rRoot: (dS - p.studFlare) / 2, rTip: (dS + p.studFlare) / 2, rTop: dS / 2,
    height: p.studHeight, chamfer: Math.min(0.25, p.studHeight * 0.15), undercut: p.studUndercut,
  };

  // ---- Pockets ----
  let pockets: Derived['pockets'] = null;
  if (p.bottomMode === 'pockets') {
    const depth = Math.min(p.socketDepth, tb - 0.6);
    if (depth < 1.7) issues.push({ level: 'warning', param: 'baseThickness', message: 'Base too thin for full-depth sockets: bricks will not seat fully.' });
    const xs = grid(xPlate0, xEnd, P, play);
    if (xs.length) pockets = { xs, zs, D: BRICK.studDiameter, fit: p.socketFit, depth };
  }

  // Thin walls
  for (const [k, v] of [['dividerThickness', td], ['tongueThickness', tt], ['armThickness', ta], ['postThickness', p.postThickness]] as const) {
    if (v < minWall) issues.push({ level: 'warning', param: k, message: `Under 2 × nozzle (${minWall.toFixed(1)} mm).` });
  }

  return {
    W, P, play, minWall, c, cArc, gzL, tb, ta, h, ya0, yTop, hy,
    Rb, Ra, rp, rCone, Lc, Lb, zMid, zones,
    xPlate0, xArm0, xEnd, channels, dividers,
    div: { td, rBall, yBall, domeR, domeC, yLip, lipTip, snap, grip },
    post, tongue, finger, tab, studGrid, stud, pockets, issues,
  };
}
