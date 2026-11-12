import type { ClipParams, ParamGroup } from '../../params/schema.ts';
import type { IssueCode } from '../../rules/derive.ts';
import { CABLE_KINDS, type CableKindId } from '../lib/cables.ts';
import { FIELDS, GROUPS } from '../lib/fields.ts';
import { en } from './en.ts';

/**
 * Languages: the plain (framework-free) half. What a translation must contain, the
 * English one put together from where the English lives, which language to pick for
 * a visitor, and how a message becomes text. The reactive half is index.svelte.ts.
 *
 * No library: about 190 short strings don't need one, the compiler already checks
 * that every language has every key, and `Intl` does plurals and number formats.
 */

/** The languages on offer. `name` is the language's name in that language. */
export const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
] as const;
export type LocaleCode = (typeof LOCALES)[number]['code'];
export const isLocale = (v: unknown): v is LocaleCode => LOCALES.some((l) => l.code === v);

/** A text that depends on a count: one form per Unicode plural category the language uses. */
export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type UiKey = keyof typeof en;

export interface Locale {
  /** the website's own wording: same keys as en.ts, plain where English is plain, plural where it is plural */
  ui: { [K in UiKey]: (typeof en)[K] extends string ? string : Plural };
  cables: Record<CableKindId, string>;
  groups: Record<ParamGroup, { title: string; blurb: string }>;
  /** `help` exactly where the English parameter has help (checked by the tests) */
  params: Record<keyof ClipParams, { label: string; help?: string }>;
  /** notes from the rules, by code. null = show the engine's own English message. */
  issues: Record<IssueCode, string> | null;
}
/** What a file in locales/ exports: everything, translated. */
export type Translation = Locale & { issues: Record<IssueCode, string> };

/** English, gathered from the files that own it, so none of it is written twice. */
export const english: Locale = {
  ui: en,
  cables: Object.fromEntries(CABLE_KINDS.map((k) => [k.id, k.label])) as Locale['cables'],
  groups: Object.fromEntries(GROUPS.map((g) => [g.id, { title: g.title, blurb: g.blurb }])) as Locale['groups'],
  params: Object.fromEntries(FIELDS.map((f) => [f.key, f.help ? { label: f.label, help: f.help } : { label: f.label }])) as Locale['params'],
  issues: null,
};

/**
 * The best language we have for what a visitor asked for (navigator.languages, most wanted first):
 * the exact tag, else the same language from another region (pt-PT gets pt-BR), else English.
 */
export function pickLocale(wanted: readonly string[]): LocaleCode {
  for (const w of wanted) {
    const tag = w.toLowerCase();
    const hit = LOCALES.find((l) => l.code.toLowerCase() === tag) ?? LOCALES.find((l) => l.code.toLowerCase().split('-')[0] === tag.split('-')[0]);
    if (hit) return hit.code;
  }
  return 'en';
}

// ---- Messages -> text ----

/** The {names} a message expects. */
type VarsOf<S> = S extends `${string}{${infer V}}${infer Rest}` ? V | VarsOf<Rest> : never;
type MessageVars<M> = M extends string ? VarsOf<M> : M extends object ? VarsOf<M[keyof M]> | 'n' : never;
/** The arguments `t(key, …)` takes after the key: nothing, or exactly the values that message uses. */
export type VarArgs<K extends UiKey> = [MessageVars<(typeof en)[K]>] extends [never] ? [] : [vars: Record<MessageVars<(typeof en)[K]>, string | number>];
export type Vars = Record<string, string | number>;

const pluralRules = new Map<string, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

/** Fill a message in. A plural message picks its form from `vars.n`. Unknown {names} are left as they are. */
export function format(message: string | Plural, vars: Vars | undefined, locale: string): string {
  let text: string;
  if (typeof message === 'string') text = message;
  else {
    let rules = pluralRules.get(locale);
    if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(locale)));
    text = message[rules.select(Number(vars?.n))] ?? message.other;
  }
  return vars ? text.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all)) : text;
}

/** A number the way the language writes it (0.25 or 0,25), with `min`..`max` decimals. `sign` shows + on zero and above. */
export function formatNumber(value: number, locale: string, min = 0, max = 2, sign = false): string {
  const key = `${locale}|${min}|${max}|${sign}`;
  let f = numberFormats.get(key);
  if (!f) numberFormats.set(key, (f = new Intl.NumberFormat(locale, { minimumFractionDigits: min, maximumFractionDigits: Math.max(min, max), signDisplay: sign ? 'always' : 'auto' })));
  return f.format(value);
}

/** A message with <b> and <em> in it, cut into pieces to render as elements. Never as HTML: a translation is text. */
export interface Piece { tag: 'b' | 'em' | null; text: string }
export function pieces(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(/<(b|em)>(.*?)<\/\1>/gs)) {
    if (m.index > last) out.push({ tag: null, text: text.slice(last, m.index) });
    out.push({ tag: m[1] as 'b' | 'em', text: m[2]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ tag: null, text: text.slice(last) });
  return out;
}
