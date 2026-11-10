import { z } from 'zod';

/**
 * Single source of truth for every user-facing parameter.
 * `.meta()` carries UI info (group, label, unit, step, help). The UI, URL
 * encoding and validation all read from this schema.
 * Units are mm and degrees unless noted.
 */

const num = (min: number, max: number, def: number, meta: ParamMeta) =>
  z.number().min(min).max(max).default(def).meta(meta);

const int = (min: number, max: number, def: number, meta: ParamMeta) =>
  z.number().int().min(min).max(max).default(def).meta(meta);

export type ParamMeta = {
  group: ParamGroup;
  label: string;
  unit?: 'mm' | 'deg' | 'count';
  step?: number;
  help?: string;
  advanced?: boolean;
};

export type ParamGroup =
  | 'channels' | 'body' | 'hinge' | 'latch' | 'studs' | 'bottom' | 'printing';

export const ClipParamsSchema = z.object({
  // Channels
  channelCount: int(1, 8, 2, { group: 'channels', label: 'Channels', unit: 'count' }),
  channelWidth: num(3, 80, 20, { group: 'channels', label: 'Channel width', unit: 'mm', step: 0.5 }),
  channelWidths: z.array(z.number().min(3).max(80)).optional()
    .meta({ group: 'channels', label: 'Per-channel widths', unit: 'mm', advanced: true,
      help: 'Overrides channel width. Length must equal the channel count.' }),
  channelHeight: num(3, 40, 9, { group: 'channels', label: 'Channel height', unit: 'mm', step: 0.5 }),

  // Body
  widthMode: z.enum(['studs', 'free']).default('studs')
    .meta({ group: 'body', label: 'Width mode', help: 'studs: width = n·pitch − 0.2 so it lines up with bricks.' }),
  studsAcross: int(1, 6, 2, { group: 'body', label: 'Width (studs)', unit: 'count' }),
  freeWidth: num(6, 100, 15.8, { group: 'body', label: 'Width', unit: 'mm', step: 0.1 }),
  baseThickness: num(2, 10, 3.2, { group: 'body', label: 'Base thickness', unit: 'mm', step: 0.1 }),
  armThickness: num(1.6, 10, 3.0, { group: 'body', label: 'Arm thickness', unit: 'mm', step: 0.1 }),
  dividerThickness: num(1.2, 6, 2.0, { group: 'body', label: 'Divider thickness', unit: 'mm', step: 0.1 }),
  endWallThickness: num(1.6, 6, 2.4, { group: 'body', label: 'End wall thickness', unit: 'mm', step: 0.1 }),
  dividerSnaps: z.boolean().default(true).meta({ group: 'body', label: 'Divider snaps',
    help: 'Each divider top is a fork that clicks around a bulb under the arm. Narrow channels fall back to a plain key.' }),
  snapBulb: num(1.6, 5, 2.8, { group: 'body', label: 'Snap bulb width', unit: 'mm', step: 0.1, advanced: true }),
  snapStem: num(0.8, 3, 1.2, { group: 'body', label: 'Snap neck width', unit: 'mm', step: 0.1, advanced: true,
    help: 'Grip per side = (bulb − neck)/2 − clearance.' }),
  keyDepth: num(0, 2, 0.8, { group: 'body', label: 'Divider key depth', unit: 'mm', step: 0.1, advanced: true,
    help: 'How far divider tops reach into the arm. Keeps cables in separate channels. 0 = off.' }),

  // Hinge
  barrelDiameter: num(5, 20, 8.6, { group: 'hinge', label: 'Barrel Ø', unit: 'mm', step: 0.1 }),
  coneDiameter: num(2, 16, 5.6, { group: 'hinge', label: 'Cone pin Ø', unit: 'mm', step: 0.1,
    help: 'Print-in-place 45° cone pins between knuckles. Clamped to fit the barrel.' }),
  radialClearance: num(0.1, 1, 0.35, { group: 'hinge', label: 'Clearance', unit: 'mm', step: 0.05,
    help: 'Gap between moving parts. Raise it if the print fuses; lower it if the clip is wobbly.' }),
  axialClearance: num(0.1, 1, 0.4, { group: 'hinge', label: 'Knuckle gap', unit: 'mm', step: 0.05 }),
  knuckles: int(3, 9, 3, { group: 'hinge', label: 'Knuckles', unit: 'count', help: 'Odd number.' })
    .refine((v) => v % 2 === 1, 'knuckles must be odd'),

  // Latch
  skirtThickness: num(1.2, 4, 1.6, { group: 'latch', label: 'Latch wall thickness', unit: 'mm', step: 0.1 }),
  catchDepth: num(0.3, 2, 0.8, { group: 'latch', label: 'Catch depth', unit: 'mm', step: 0.05,
    help: 'Deeper = holds tighter, harder to open.' }),
  catchAngle: num(10, 60, 30, { group: 'latch', label: 'Catch release angle', unit: 'deg', step: 1,
    advanced: true, help: 'Lower = locks harder.' }),
  tabLength: num(0, 15, 4, { group: 'latch', label: 'Thumb tab length', unit: 'mm', step: 0.5 }),

  // Studs (top)
  studsOn: z.boolean().default(true).meta({ group: 'studs', label: 'Studs on top' }),
  studPitch: num(7.5, 8.5, 8.0, { group: 'studs', label: 'Stud pitch', unit: 'mm', step: 0.01, advanced: true }),
  studDiameter: num(4, 5.5, 4.8, { group: 'studs', label: 'Stud Ø', unit: 'mm', step: 0.01 }),
  studHeight: num(1, 2.2, 1.7, { group: 'studs', label: 'Stud height', unit: 'mm', step: 0.05 }),
  studFit: num(-0.3, 0.3, 0, { group: 'studs', label: 'Stud fit', unit: 'mm', step: 0.01,
    help: 'Added to the stud Ø. Use the calibration print to find yours.' }),

  // Bottom (brick sockets)
  bottomMode: z.enum(['cavity', 'holes', 'flat']).default('cavity')
    .meta({ group: 'bottom', label: 'Bottom', help: 'cavity: brick-style underside with tubes. holes: one hole per stud.' }),
  socketFit: num(-0.3, 0.3, 0, { group: 'bottom', label: 'Socket fit', unit: 'mm', step: 0.01,
    help: 'Positive = looser grip on real bricks.' }),

  // Printing
  orientation: z.enum(['flat', 'side']).default('flat')
    .meta({ group: 'printing', label: 'Print orientation',
      help: 'flat: studs up, best brick fit (default). side: hinge vertical, like the original design.' }),
  layerHeight: num(0.08, 0.4, 0.2, { group: 'printing', label: 'Layer height', unit: 'mm', step: 0.02,
    help: 'Gaps along the print Z axis are rounded up to whole layers.' }),
  nozzle: num(0.2, 1.0, 0.4, { group: 'printing', label: 'Nozzle', unit: 'mm', step: 0.05 }),
  elephantFoot: num(0, 0.6, 0.2, { group: 'printing', label: 'First-layer inset', unit: 'mm', step: 0.05,
    help: 'Shrinks the first layer so squished plastic does not weld moving parts together.' }),
  segmentLength: num(0.1, 1, 0.3, { group: 'printing', label: 'Curve resolution', unit: 'mm', step: 0.05,
    advanced: true, help: 'Max edge length on curves. Smaller = smoother, bigger file.' }),
});

export type ClipParamsInput = z.input<typeof ClipParamsSchema>;
export type ClipParams = z.output<typeof ClipParamsSchema>;

export const parseParams = (input: unknown = {}): ClipParams => ClipParamsSchema.parse(input);
export const DEFAULTS: ClipParams = parseParams({});
