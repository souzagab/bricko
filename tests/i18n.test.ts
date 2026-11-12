import { describe, expect, it } from 'vitest';
import { ISSUE_TEXT, type IssueCode } from '../src/rules/derive.ts';
import { LOCALES, english, format, formatNumber, pickLocale, pieces, type Plural, type Translation } from '../src/web/i18n/catalog.ts';

// Every file in locales/ is picked up, so a new language is checked the moment it is added.
const files = import.meta.glob<{ default: Translation }>('../src/web/i18n/locales/*.ts', { eager: true });
const locales = Object.entries(files).map(([path, m]) => [path.match(/([^/]+)\.ts$/)![1]!, m.default] as const);
const components = import.meta.glob<string>('../src/web/**/*.svelte', { query: '?raw', import: 'default', eager: true });

const vars = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();
const tags = (s: string) => [...s.matchAll(/<\/?\w+>/g)].map((m) => m[0]).sort();
const forms = (m: string | Plural): string[] => (typeof m === 'string' ? [m] : Object.values(m));
/** The value names an English rule note reads, found by handing it an object that remembers what was asked for. */
const issueVars = (code: IssueCode) => {
  const seen = new Set<string>();
  (ISSUE_TEXT[code] as (a: Record<string, number>) => string)(new Proxy({}, { get: (_, k) => (seen.add(String(k)), 1) }));
  return [...seen].sort();
};

describe('languages', () => {
  it('the list and the files agree', () => {
    expect(locales.map(([code]) => code).sort()).toEqual(LOCALES.map((l) => l.code).filter((c) => c !== 'en').sort());
    expect(LOCALES[0].code).toBe('en');
    expect(new Set(LOCALES.map((l) => l.name)).size).toBe(LOCALES.length);
  });

  it('English is well formed', () => {
    for (const [key, m] of Object.entries(english.ui)) {
      for (const s of forms(m)) {
        expect(s.trim(), key).toBe(s);
        expect(pieces(s).every((p) => !/[<>]/.test(p.text)), `${key}: only <b> and <em>, properly closed`).toBe(true);
      }
    }
  });

  describe.each(locales)('%s', (_code, loc) => {
    it('has every text, of the same kind, and nothing else', () => {
      expect(Object.keys(loc.ui).sort()).toEqual(Object.keys(english.ui).sort());
      for (const [key, m] of Object.entries(loc.ui)) {
        const src = english.ui[key as keyof typeof english.ui];
        expect(typeof m, key).toBe(typeof src);
        for (const s of forms(m)) expect(s.trim().length, key).toBeGreaterThan(0);
      }
    });

    it('keeps every {value} and every <b> / <em>', () => {
      for (const [key, m] of Object.entries(loc.ui)) {
        const src = english.ui[key as keyof typeof english.ui];
        if (typeof m === 'string') {
          expect(vars(m), key).toEqual(vars(src as string));
          expect(tags(m), key).toEqual(tags(src as string));
        } else {
          // a plural form may leave the count out ("stud"), but can't use a value English doesn't have
          const allowed = new Set(forms(src).flatMap(vars));
          for (const s of forms(m)) for (const v of vars(s)) expect(allowed.has(v), `${key}: {${v}}`).toBe(true);
          expect(vars(m.other), key).toEqual(vars((src as Plural).other));
        }
        for (const s of forms(m)) expect(pieces(s).every((p) => !/[<>]/.test(p.text)), `${key}: tags closed`).toBe(true);
      }
    });

    it('is translated, not copied', () => {
      // short words can match by chance (Standard, HDMI); a whole sentence can't
      for (const [key, m] of Object.entries(loc.ui)) {
        const src = english.ui[key as keyof typeof english.ui];
        if (typeof m === 'string' && m.length > 24) expect(m, key).not.toBe(src);
      }
    });

    it('names every cable, group and parameter, with help where English has help', () => {
      expect(Object.keys(loc.cables).sort()).toEqual(Object.keys(english.cables).sort());
      expect(Object.keys(loc.groups).sort()).toEqual(Object.keys(english.groups).sort());
      for (const [id, g] of Object.entries(loc.groups)) {
        expect(g.title.length, id).toBeGreaterThan(0);
        expect(!!g.blurb, id).toBe(!!english.groups[id as keyof typeof english.groups].blurb);
      }
      expect(Object.keys(loc.params).sort()).toEqual(Object.keys(english.params).sort());
      for (const [key, p] of Object.entries(loc.params)) {
        expect(p.label.length, key).toBeGreaterThan(0);
        expect(!!p.help, `${key} help`).toBe(!!english.params[key as keyof typeof english.params].help);
      }
    });

    it('has every rule note, with the values the rules send', () => {
      expect(Object.keys(loc.issues).sort()).toEqual(Object.keys(ISSUE_TEXT).sort());
      for (const [code, text] of Object.entries(loc.issues)) expect(vars(text), code).toEqual(issueVars(code as IssueCode));
    });
  });

  it('picks the closest language a visitor asked for', () => {
    expect(pickLocale(['pt', 'en'])).toBe('pt-BR');
    expect(pickLocale(['pt-PT'])).toBe('pt-BR'); // same language, other region
    expect(pickLocale(['PT-br'])).toBe('pt-BR');
    expect(pickLocale(['ja', 'pt-BR', 'en'])).toBe('pt-BR'); // first one we have, in their order
    expect(pickLocale(['en-GB', 'pt-BR'])).toBe('en');
    expect(pickLocale(['ja', 'ko'])).toBe('en');
    expect(pickLocale([])).toBe('en');
  });

  it('fills messages in', () => {
    expect(format('{mm} mm wide', { mm: '15.8' }, 'en')).toBe('15.8 mm wide');
    expect(format('{a} and {missing}', { a: 1 }, 'en')).toBe('1 and {missing}');
    const dots: Plural = { one: '{n} dot', other: '{n} dots' };
    expect([1, 2, 5].map((n) => format(dots, { n }, 'en'))).toEqual(['1 dot', '2 dots', '5 dots']);
    expect(format({ other: 'x' }, { n: 1 }, 'en')).toBe('x'); // a form the language has but the text doesn't: falls back
    expect(formatNumber(0.25, 'en', 2, 2)).toBe('0.25');
    expect(formatNumber(0.25, 'de', 2, 2)).toBe('0,25');
    expect(formatNumber(0, 'en', 2, 2, true)).toBe('+0.00');
    expect(formatNumber(7.5, 'pt-BR')).toBe('7,5');
    expect(pieces('a <b>b</b> c <em>d</em>')).toEqual([{ tag: null, text: 'a ' }, { tag: 'b', text: 'b' }, { tag: null, text: ' c ' }, { tag: 'em', text: 'd' }]);
  });

  it('no wording is typed straight into a component', () => {
    // Text between tags, and the attributes a screen reader or a tooltip speaks, must come from t(…).
    const allowed = new Set(['Bricko']);
    for (const [path, source] of Object.entries(components)) {
      const markup = source.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
      const text = [...markup.matchAll(/>([^<>{}]*[A-Za-z]{3,}[^<>{}]*)</g)].map((m) => m[1]!.trim()).filter((s) => !allowed.has(s));
      expect(text, `${path}: text in markup`).toEqual([]);
      const spoken = [...markup.matchAll(/\b(aria-label|title|placeholder|alt)="([^"{]*[A-Za-z]{3,}[^"]*)"/g)].map((m) => m[0]);
      expect(spoken, `${path}: spoken attributes`).toEqual([]);
    }
  });
});
