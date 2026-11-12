import type { ClipParams, ParamGroup } from '../../params/schema.ts';
import type { Issue } from '../../rules/derive.ts';
import type { CableKindId } from '../lib/cables.ts';
import { english, format, formatNumber, isLocale, pickLocale, type Locale, type LocaleCode, type UiKey, type VarArgs } from './catalog.ts';

/**
 * Languages: the half that holds the current one. It is Svelte state, so `t(…)` in a template stays reactive.
 *
 * English is built in. Each other language is its own small file, fetched only
 * when it is needed.
 */
const loaders = import.meta.glob<{ default: Locale }>('./locales/*.ts');

let code = $state<LocaleCode>('en');
let dict = $state.raw<Locale>(english);

export const i18n = {
  /** the language on screen */
  get locale(): LocaleCode { return code; },
};

/** The website's own wording, by key. The compiler checks the key and the values it needs. */
export function t<K extends UiKey>(key: K, ...vars: VarArgs<K>): string {
  return format(dict.ui[key], vars[0], code);
}
/** A number the way the current language writes it. */
export const num = (value: number, max = 2, min = 0): string => formatNumber(value, code, min, max);
/** The same, always with its sign (+0.05). */
export const signed = (value: number, digits = 2): string => formatNumber(value, code, digits, digits, true);

export const paramLabel = (key: keyof ClipParams): string => dict.params[key].label;
export const paramHelp = (key: keyof ClipParams): string | undefined => dict.params[key].help;
export const groupText = (id: ParamGroup): { title: string; blurb: string } => dict.groups[id];
export const cableName = (id: string): string => dict.cables[id as CableKindId] ?? id;

/** A note from the rules: translated from its code and numbers, or the engine's own English if this language has no text for it. */
export function issueText(issue: Issue): string {
  const text = dict.issues?.[issue.code];
  if (!text) return issue.message;
  return format(text, Object.fromEntries(Object.entries(issue.args).map(([k, v]) => [k, num(v)])), code);
}

function show() {
  document.documentElement.lang = code;
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
}

/**
 * Pick the language once, at startup, with nothing to click: `?lang=` in the address (a link someone
 * made on purpose), else the browser's languages. Anything we don't have, or fail to load, is English.
 */
export async function initLocale(): Promise<void> {
  const linked = new URLSearchParams(location.search).get('lang');
  const start = isLocale(linked) ? linked : pickLocale(navigator.languages ?? [navigator.language]);
  try {
    if (start !== 'en') dict = (await loaders[`./locales/${start}.ts`]!()).default;
    code = start;
  } catch { /* stays English */ }
  show();
}
