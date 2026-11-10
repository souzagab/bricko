import { z } from 'zod';
import { ClipParamsSchema, type ClipParams, type ParamGroup } from '../../params/schema.ts';

/** UI field specs, derived from the zod schema, so the form never drifts from validation. */
export type FieldKind = 'number' | 'integer' | 'boolean' | 'enum' | 'array';
export type ParamKey = keyof ClipParams;

export interface Field {
  key: ParamKey;
  kind: FieldKind;
  label: string;
  group: ParamGroup;
  unit?: string;
  help?: string;
  advanced: boolean;
  min?: number;
  max?: number;
  step: number;
  def?: unknown;
  options?: { value: string; label: string }[];
}

export const GROUPS: { id: ParamGroup; title: string; blurb: string }[] = [
  { id: 'channels', title: 'Channels', blurb: 'How many cables, and how big.' },
  { id: 'body', title: 'Body', blurb: 'Overall size and wall thickness.' },
  { id: 'dividers', title: 'Dividers', blurb: 'The walls between channels.' },
  { id: 'hinge', title: 'Hinge & fit', blurb: 'Print-in-place hinge and the gap between moving parts.' },
  { id: 'latch', title: 'Latch', blurb: 'The hook that keeps the clip shut.' },
  { id: 'studs', title: 'Studs', blurb: 'Brick-compatible studs on top.' },
  { id: 'bottom', title: 'Bottom', blurb: 'Sockets that press onto bricks and baseplates.' },
  { id: 'printing', title: 'Printing', blurb: 'Match these to your printer.' },
];

const ENUM_LABELS: Record<string, string> = { pockets: 'Brick sockets', flat: 'Flat' };

interface JsonProp {
  type?: string;
  minimum?: number;
  maximum?: number;
  default?: unknown;
  enum?: string[];
  group: ParamGroup;
  label: string;
  unit?: string;
  step?: number;
  help?: string;
  advanced?: boolean;
}

const json = z.toJSONSchema(ClipParamsSchema, { io: 'input' }) as unknown as { properties: Record<string, JsonProp> };

export const FIELDS: Field[] = Object.entries(json.properties).map(([key, s]) => {
  const kind: FieldKind = s.enum ? 'enum'
    : s.type === 'boolean' ? 'boolean'
    : s.type === 'integer' ? 'integer'
    : s.type === 'array' ? 'array'
    : 'number';
  return {
    key: key as ParamKey,
    kind,
    label: s.label,
    group: s.group,
    unit: s.unit === 'count' ? undefined : s.unit,
    help: s.help,
    advanced: !!s.advanced,
    min: s.minimum,
    max: s.maximum,
    step: kind === 'integer' ? 1 : s.step ?? 0.1,
    def: s.default,
    options: s.enum?.map((v) => ({ value: v, label: ENUM_LABELS[v] ?? v })),
  };
});

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<ParamKey, Field>;

/** Decimal places worth showing for a step (0.05 -> 2). */
export const decimals = (step: number) => Math.max(0, Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)));
