#!/usr/bin/env node
/**
 * Smoke test of the built site in a real browser (headless Chromium):
 * loads the page, waits for the first model, checks for console errors,
 * changes a parameter, downloads the STL and saves screenshots.
 *
 *   npm run build && node tools/screenshots.mjs [outDir]
 *   CHROME=/path/to/chrome node tools/screenshots.mjs
 *   URL=https://souzagab.github.io/bricko/ node tools/screenshots.mjs out/live
 */
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'out/shots';
await mkdir(out, { recursive: true });
const executablePath = process.env.CHROME ?? ['/usr/bin/chromium', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find(existsSync);
if (!executablePath) throw new Error('No Chromium found. Set CHROME=/path/to/chrome');

// URL=https://… runs against a deployed site instead of a local preview of dist/
const server = process.env.URL ? null : await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'error' });
const url = process.env.URL ?? 'http://localhost:4179/';
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
let failed = false;

async function session(name, viewport, fn) {
  // fn.touch: a phone or tablet (touch screen, coarse pointer, mobile viewport rules)
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, acceptDownloads: true, locale: fn.locale ?? 'en-US', ...(fn.touch ? { isMobile: true, hasTouch: true } : {}) });
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${name}] console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  const t0 = Date.now();
  await page.goto(url + (fn.hash ?? ''));
  await page.waitForSelector(fn.waitFor ?? '.stats', { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.status.show'), null, { timeout: 60000 });
  const firstModelMs = Date.now() - t0;
  await page.waitForTimeout(400);
  const res = await fn(page);
  await page.screenshot({ path: join(out, `${name}.png`) });
  await page.close();
  return { firstModelMs, ...res };
}

const report = {};
const idle = (page) => page.waitForFunction(() => !document.querySelector('.status.show'), null, { timeout: 30000 });
const statsChange = (page, before) => page.waitForFunction((s) => document.querySelector('.stats')?.textContent !== s, before, { timeout: 30000 });
const sizeOf = async (path) => (await import('node:fs')).statSync(path).size;
try {
  report.desktop = await session('desktop', { width: 1440, height: 900 }, async (page) => {
    const stats0 = await page.textContent('.stats');
    // a first-time user: add a cable, make it an HDMI cable, download
    await page.click('button.add');
    await statsChange(page, stats0); await idle(page);
    const stats1 = await page.textContent('.stats');
    await page.selectOption('select[aria-label="Cable 4"]', 'hdmi');
    await statsChange(page, stats1); await idle(page);
    await page.waitForFunction(() => location.hash.includes('cables='), null, { timeout: 5000 });
    const hash = await page.evaluate(() => location.hash);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button.primary')]);
    const path = join(out, dl.suggestedFilename());
    await dl.saveAs(path);
    await page.waitForSelector('.toast');
    return { stats0, stats2: await page.textContent('.stats'), hash, download: dl.suggestedFilename(), bytes: await sizeOf(path) };
  });
  report.open = await session('desktop-open-dark', { width: 1280, height: 800 }, Object.assign(async (page) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.click('text=Open lid');
    await page.waitForTimeout(1300);
    return { button: await page.textContent('.toolbar .pill') };
  }, { hash: '#v=1&dividerSnap=1' }));
  report.advanced = await session('desktop-advanced-print', { width: 1280, height: 800 }, async (page) => {
    await page.click('text=On the printer');
    await page.click('text=Advanced settings');
    await page.fill('#cut', '0.5');
    await page.dispatchEvent('#cut', 'input');
    await page.waitForTimeout(400);
    return { groups: await page.$$eval('.adv .group h3', (hs) => hs.map((h) => h.textContent)) };
  });
  report.testPrint = await session('test-print', { width: 1280, height: 800 }, async (page) => {
    await page.click('text=Print a fit test first');
    await page.waitForSelector('.dialog');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('.dialog button.primary')]);
    const path = join(out, dl.suggestedFilename());
    await dl.saveAs(path);
    await page.waitForSelector('.dialog .ok');
    await page.click('.dialog .tr:nth-child(5) button:nth-of-type(1)'); // 4-dot clearance
    await page.waitForFunction(() => location.hash.includes('clearance=0.3'), null, { timeout: 5000 });
    return { download: dl.suggestedFilename(), bytes: await sizeOf(path), applied: await page.evaluate(() => location.hash) };
  });
  // Phones. `fits` = nothing is wider than the screen; `small` = things you press that are under 44 px;
  // `zoomers` = form fields under 16 px (iOS zooms the page when one is focused). All three must stay empty/true.
  const phone = (page) => page.evaluate(() => {
    const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && el.closest('[inert]') === null; };
    const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 24);
    const pressable = [...document.querySelectorAll('button, select, summary, label.toggle, .brand')].filter(seen);
    return {
      layout: document.querySelector('.app').className.match(/\b(desk|side|sheet)\b/)?.[0],
      sheet: Math.round(document.querySelector('aside').getBoundingClientRect().height),
      fits: [...document.querySelectorAll('.app, .app > *, .aside-body > *')].every((el) => el.getBoundingClientRect().right <= innerWidth + 1),
      // a segmented control's buttons sit in a 44 px track, and a link inside a sentence is exempt
      small: pressable.filter((el) => !el.closest('.seg, .issues')).filter((el) => { const r = el.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map(name),
      zoomers: [...document.querySelectorAll('select, input:not([type=range]):not([type=checkbox])')].filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map(name),
    };
  });
  const sheetTo = async (page, key) => { await page.focus('.handle'); await page.keyboard.press(key); await page.waitForTimeout(450); };
  report.mobile = await session('mobile', { width: 390, height: 844 }, Object.assign(async (page) => {
    const half = await phone(page);
    // the preview stays in view while you change things: add a cable with the sheet half up, then download from the bar
    const stats0 = await page.textContent('.stats');
    await page.tap('button.add');
    await statsChange(page, stats0); await idle(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.tap('.bar button.primary')]);
    await page.waitForSelector('.bar .toast');
    await page.tap('.toast .dismiss');
    return { half, download: dl.suggestedFilename() };
  }, { touch: true }));
  report.mobileSheet = await session('mobile-sheet', { width: 390, height: 844 }, Object.assign(async (page) => {
    await page.tap('.handle'); // tap: tuck the sheet away
    await page.waitForTimeout(450);
    const peek = await phone(page);
    await sheetTo(page, 'ArrowUp'); await sheetTo(page, 'ArrowUp'); // keyboard: all the way up
    await page.tap('text=Advanced settings');
    await page.tap('.adv .group summary');
    await page.evaluate(() => document.querySelector('.adv .group').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    return { peek, full: await phone(page) };
  }, { touch: true }));
  report.mobileSmall = await session('mobile-small', { width: 320, height: 568 }, Object.assign(async (page) => {
    await page.selectOption('select[aria-label="Cable 1"]', 'custom'); // the widest row there is
    await idle(page);
    return phone(page);
  }, { touch: true }));
  report.mobileLandscape = await session('mobile-landscape', { width: 844, height: 390 }, Object.assign(async (page) => phone(page), { touch: true }));
  report.mobileTestPrint = await session('mobile-test-print', { width: 390, height: 844 }, Object.assign(async (page) => {
    await page.tap('text=Print a fit test first');
    await page.waitForSelector('.dialog[open]');
    await page.waitForTimeout(300);
    const box = await page.locator('.dialog').boundingBox();
    return { fullWidth: box.width === 390, atBottom: Math.round(box.y + box.height) === 844 };
  }, { touch: true }));
  // Languages: picked from the browser, with nothing to click; a link can also ask for one (?lang=)
  const langOf = async (page) => ({ lang: await page.getAttribute('html', 'lang'), title: await page.title(), button: await page.textContent('.bar .primary'), ...(await phone(page)) });
  report.languageAuto = await session('language-pt', { width: 390, height: 844 }, Object.assign((page) => langOf(page), { touch: true, locale: 'pt-PT' }));
  report.languageLink = await session('language-link', { width: 390, height: 844 }, Object.assign((page) => langOf(page), { touch: true, hash: '?lang=pt-BR' }));
  report.languageOther = await session('language-fallback', { width: 390, height: 844 }, Object.assign((page) => langOf(page), { touch: true, locale: 'ja-JP' }));
  for (const k of ['languageAuto', 'languageLink']) if (report[k].lang !== 'pt-BR' || report[k].button !== 'Baixar STL') problems.push(`[${k}] did not come up in Portuguese`);
  if (report.languageOther.lang !== 'en' || report.languageOther.button !== 'Download STL') problems.push('a language we do not have did not fall back to English');
  for (const [k, r] of Object.entries(report)) {
    for (const m of [r, r.half, r.peek, r.full].filter((m) => m?.layout)) {
      if (!m.fits) problems.push(`[${k}] wider than the screen`);
      if (m.small.length) problems.push(`[${k}] targets under 44px: ${m.small.join(', ')}`);
      if (m.zoomers.length) problems.push(`[${k}] fields under 16px: ${m.zoomers.join(', ')}`);
    }
  }
  if (report.mobile.half.layout !== 'sheet' || report.mobileLandscape.layout !== 'side') problems.push('wrong layout for a phone');
  if (!(report.mobileSheet.peek.sheet < report.mobile.half.sheet && report.mobile.half.sheet < report.mobileSheet.full.sheet)) problems.push('settings sheet does not move between its stops');
  if (!report.mobileTestPrint.fullWidth || !report.mobileTestPrint.atBottom) problems.push('fit-test dialog is not a bottom sheet on phones');
  report.error = await session('error-state', { width: 1280, height: 800 }, Object.assign(async (page) => {
    return { message: await page.textContent('.blocked') };
  }, { hash: '#v=1&studsAcross=1&barrelDiameter=16&pinDiameter=2&cables=30', waitFor: '.blocked' }));
} catch (e) {
  failed = true;
  problems.push(`exception: ${e.message}`);
} finally {
  await browser.close();
  if (server) await new Promise((r) => server.httpServer.close(r));
}
await writeFile(join(out, 'report.json'), JSON.stringify({ report, problems }, null, 2));
console.log(JSON.stringify({ report, problems }, null, 2));
process.exit(failed || problems.length ? 1 : 0);
