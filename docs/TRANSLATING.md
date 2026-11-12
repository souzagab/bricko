# Translating Bricko

The website speaks English and Português (Brasil). English is the source. There is no language picker: the site follows the browser.

> Corrections are very welcome: each language is one file, and fixing a sentence is a one-line pull request.

## Fix a translation

Edit the sentence in `src/web/i18n/locales/<language>.ts` and run `npm test`.

## Add a language

1. Copy `src/web/i18n/locales/pt-BR.ts` to `<code>.ts` (a BCP 47 tag: `it`, `nl`, `pt-PT`…) and translate every string.
2. Add `{ code, name }` to `LOCALES` in `src/web/i18n/catalog.ts`. `name` is the language's own name ("Italiano").
3. `npm run check && npm test`. The compiler lists any missing or extra key; the tests check the rest (below).
4. Look at it on a phone-sized window: `http://localhost:5173/?lang=<code>`. German-length words are the usual trouble.

Rules for the text:

- `{name}` is a value the app fills in. Keep the braces and the name; move it wherever the sentence needs it.
- `<b>…</b>` and `<em>…</em>` mark emphasis. Keep the tags around the matching words. No other markup: a translation is text, never HTML.
- `{ one: '…', other: '…' }` depends on a count (`{n}`). Add the forms your language needs: `zero`, `one`, `two`, `few`, `many`, `other`.
- Write numbers the way your language does (`3,2 mm`). Numbers the app fills in are formatted for you.
- Keep the view names, the lid button and the table headings short: they sit in tight places on a phone.
- No brand names. "Building bricks", not a trademark.

## Add or change English wording

- The site's own wording is in `src/web/i18n/en.ts`. Use it with `t('some.key', { value })`; the compiler checks the key and the values. Put `<Rich text={t(…)} />` around text that carries `<b>`/`<em>`.
- Parameter names and help live in `src/params/schema.ts`, parameter groups in `src/web/lib/fields.ts`, cable names in `src/web/lib/cables.ts`, and rule notes in `ISSUE_TEXT` in `src/rules/derive.ts`. The command line uses that English directly.
- Then add the same key to every file in `locales/`. The build fails until you do: a half-translated page never ships.

## How it works

- `src/web/i18n/catalog.ts`: what a language must contain, which language a visitor gets, messages to text. No dependencies beyond `Intl` (plurals, number formats).
- `src/web/i18n/index.svelte.ts`: the current language, chosen once at startup.
- English is in the main bundle. Every other language is a separate ~5 kB file, fetched only when used.
- Which language: `?lang=xx` in the address, else the browser's languages (`pt-PT` gets `pt-BR`), else English. Share links carry no language: whoever opens one sees their own.
- The rules engine reports notes as a code plus numbers (`barrelClamped`, `{ d: 8.6 }`); the site words them. Self-check failures and validator details are diagnostics and stay in English, so a bug report reads the same everywhere.
- File names and the text inside STL files stay English.

`tests/i18n.test.ts` checks, for every file in `locales/`: same keys as English, same `{values}` and tags, help text exactly where English has it, every rule note with the values the engine sends, no sentence left in English, and no wording typed straight into a component.

Not done yet: right-to-left languages. The layout uses left/right in places and would need a pass first.
