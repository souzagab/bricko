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
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, acceptDownloads: true });
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
  report.mobile = await session('mobile', { width: 390, height: 844 }, async () => ({}));
  report.mobileSheet = await session('mobile-sheet', { width: 390, height: 844 }, async (page) => {
    await page.click('.sheet-handle');
    await page.waitForTimeout(400);
    return {};
  });
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
