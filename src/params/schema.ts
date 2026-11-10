import { z } from 'zod';

/**
 * Single source of truth for every user-facing parameter.
 * `.meta()` carries UI info (group, label, unit, step, help). The UI, URL
 * encoding and validation all read from this schema.
 * Units are mm and degrees. Brick dimensions default to the standard system
 * (8.0 mm pitch, 4.8 mm studs 1.7 mm tall, 3.2 mm plates, 0.2 mm play);
 * clearances default to values that work on most printers.
 */

export type ParamMeta = {
  group: ParamGroup;
  label: string;
  unit?: 'mm' | 'deg' | 'count';
  step?: number;
  help?: string;
  advanced?: boolean;
};

export type ParamGroup = 'channels' | 'body' | 'dividers' | 'hinge' | 'latch' | 'studs' | 'bottom' | 'printing';

const num = (min: number, max: number, def: number, meta: ParamMeta) =>
  z.number().min(min).max(max).default(def).meta(meta);
const int = (min: number, max: number, def: number, meta: ParamMeta) =>
  z.number().int().min(min).max(max).default(def).meta(meta);

export const ClipParamsSchema = z.object({
  // Channels
  channelCount: int(1, 8, 2, { group: 'channels', label: 'Channels', unit: 'count' }),
  channelWidth: num(3, 60, 19.5, { group: 'channels', label: 'Channel width', unit: 'mm', step: 0.5 }),
  channelWidths: z.array(z.number().min(3).max(60)).optional()
    .meta({ group: 'channels', label: 'Per-channel widths', unit: 'mm', advanced: true,
      help: 'Overrides channel width. Length must equal the channel count.' }),
  channelHeight: num(6, 30, 9.6, { group: 'channels', label: 'Channel height', unit: 'mm', step: 0.05 }),

  // Body
  studsAcross: int(1, 6, 2, { group: 'body', label: 'Width (studs)', unit: 'count' }),
  snapLength: z.boolean().default(true).meta({ group: 'body', label: 'Round length to whole studs',
    help: 'Stretches the channels a little so the clip is a whole number of studs long.' }),
  baseThickness: num(2.4, 8, 3.2, { group: 'body', label: 'Base thickness', unit: 'mm', step: 0.05, help: 'Standard plate height is 3.2 mm.' }),
  armThickness: num(1.6, 8, 3.2, { group: 'body', label: 'Lid thickness', unit: 'mm', step: 0.05, help: 'Standard plate height is 3.2 mm.' }),
  floorFillet: num(0, 4, 1.85, { group: 'body', label: 'Floor fillet', unit: 'mm', step: 0.05, advanced: true }),

  // Dividers
  dividerThickness: num(1.2, 5, 2.03, { group: 'dividers', label: 'Divider thickness', unit: 'mm', step: 0.01 }),
  ballDiameter: num(0, 6, 2.96, { group: 'dividers', label: 'Ball Ø', unit: 'mm', step: 0.01,
    help: 'The ball on each divider narrows the channel mouth so cables stay in while the clip is open. 0 = straight divider.' }),
  dividerSnap: z.boolean().default(false).meta({ group: 'dividers', label: 'Snap dividers',
    help: 'Arm lips reach under each ball, so every divider clicks shut too. The end latch already locks the clip.' }),
  snapDepth: num(0.6, 2.5, 1.3, { group: 'dividers', label: 'Snap depth', unit: 'mm', step: 0.05, advanced: true,
    help: 'How far below the ball centre the lips reach. Deeper = firmer click.' }),

  // Hinge
  barrelDiameter: num(5, 16, 8.63, { group: 'hinge', label: 'Barrel Ø', unit: 'mm', step: 0.01 }),
  pinDiameter: num(2, 10, 5.08, { group: 'hinge', label: 'Pin Ø', unit: 'mm', step: 0.01 }),
  middleKnuckle: num(1.2, 40, 4.7, { group: 'hinge', label: 'Middle knuckle length', unit: 'mm', step: 0.1, advanced: true,
    help: 'Full-diameter length of the base knuckle. The 45° cones and arm knuckles share the rest of the width.' }),
  coneStep: num(0.2, 2, 0.7, { group: 'hinge', label: 'Cone step', unit: 'mm', step: 0.05, advanced: true,
    help: 'Radial step from the pin to where the 45° cone starts.' }),

  // Clearance (all moving gaps)
  clearance: num(0.1, 0.8, 0.25, { group: 'hinge', label: 'Clearance', unit: 'mm', step: 0.01,
    help: 'Gap between all moving parts. Raise it if the print fuses; lower it if it rattles. Print the test piece to find yours.' }),

  // Latch
  postThickness: num(1.4, 4, 2.17, { group: 'latch', label: 'Latch post thickness', unit: 'mm', step: 0.01 }),
  hookOverhang: num(0.8, 3, 1.78, { group: 'latch', label: 'Hook overhang', unit: 'mm', step: 0.01, advanced: true }),
  catchOverlap: num(0.3, 2, 0.9, { group: 'latch', label: 'Catch overlap', unit: 'mm', step: 0.05,
    help: 'How far the arm finger reaches under the hook ledge. More = locks tighter, harder to open.' }),
  tongueThickness: num(1.2, 4, 2.1, { group: 'latch', label: 'Latch tongue thickness', unit: 'mm', step: 0.05 }),
  tabLength: num(0, 15, 5, { group: 'latch', label: 'Thumb tab length', unit: 'mm', step: 0.5 }),

  // Studs (arm top)
  studsOn: z.boolean().default(true).meta({ group: 'studs', label: 'Studs on top' }),
  studPitch: num(7.5, 8.5, 8.0, { group: 'studs', label: 'Stud pitch', unit: 'mm', step: 0.01, advanced: true }),
  brickPlay: num(0, 0.6, 0.2, { group: 'studs', label: 'Brick play', unit: 'mm', step: 0.01, advanced: true,
    help: 'Parts are n × pitch minus this, so neighbouring bricks do not rub. Standard is 0.2 mm.' }),
  studDiameter: num(4, 5.6, 4.8, { group: 'studs', label: 'Stud Ø', unit: 'mm', step: 0.01 }),
  studHeight: num(1, 2.4, 1.7, { group: 'studs', label: 'Stud height', unit: 'mm', step: 0.05 }),
  studFlare: num(0, 0.6, 0, { group: 'studs', label: 'Stud flare', unit: 'mm', step: 0.01, advanced: true,
    help: 'Taper studs from Ø−flare at the root to Ø+flare near the tip, for a tighter wedge fit. Standard studs are straight (0).' }),
  studUndercut: num(0, 45, 23, { group: 'studs', label: 'Stud underside angle', unit: 'deg', step: 1, advanced: true,
    help: 'Flattens the downward side of each sideways-printed stud so it prints without support. 0 = off.' }),
  studFit: num(-0.3, 0.3, 0, { group: 'studs', label: 'Stud fit', unit: 'mm', step: 0.01,
    help: 'Added to the stud Ø. Use the test print to find yours.' }),

  // Bottom (brick sockets)
  bottomMode: z.enum(['pockets', 'flat']).default('pockets')
    .meta({ group: 'bottom', label: 'Bottom', help: 'pockets: presses onto bricks and baseplates.' }),
  socketDepth: num(1, 4, 2.0, { group: 'bottom', label: 'Socket depth', unit: 'mm', step: 0.05, advanced: true }),
  socketFit: num(-0.2, 0.4, 0.05, { group: 'bottom', label: 'Socket fit', unit: 'mm', step: 0.01,
    help: 'Gap between a real stud and the pocket walls. Bigger = looser.' }),

  // Printing (always printed on its side: hinge axis vertical)
  layerHeight: num(0.08, 0.4, 0.2, { group: 'printing', label: 'Layer height', unit: 'mm', step: 0.02,
    help: 'Gaps along the print height are rounded up to whole layers.' }),
  nozzle: num(0.2, 1.0, 0.4, { group: 'printing', label: 'Nozzle', unit: 'mm', step: 0.05 }),
  elephantFoot: num(0, 0.6, 0.15, { group: 'printing', label: 'First-layer inset', unit: 'mm', step: 0.05,
    help: 'Shrinks the first layer so squished plastic does not weld moving parts together. Set 0 if your slicer already compensates.' }),
  segmentLength: num(0.1, 1, 0.3, { group: 'printing', label: 'Curve resolution', unit: 'mm', step: 0.05,
    advanced: true, help: 'Max edge length on curves. Smaller = smoother, bigger file.' }),
});

export type ClipParamsInput = z.input<typeof ClipParamsSchema>;
export type ClipParams = z.output<typeof ClipParamsSchema>;

export const parseParams = (input: unknown = {}): ClipParams => ClipParamsSchema.parse(input);
export const DEFAULTS: ClipParams = parseParams({});
