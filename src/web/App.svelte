<script lang="ts">
  import { onMount } from 'svelte';
  import { ClipParamsSchema, parseParams } from '../params/schema.ts';
  import { toBinaryStl } from '../export/stl.ts';
  import { app } from './lib/state.svelte.ts';
  import { Engine } from './lib/engine.ts';
  import { decodeParams, encodeParams } from './lib/url.ts';
  import { fileName } from './lib/names.ts';
  import Viewer from './components/Viewer.svelte';
  import Controls from './components/Controls.svelte';
  import Issues from './components/Issues.svelte';
  import Guide from './components/Guide.svelte';
  import TestPrint from './components/TestPrint.svelte';

  let engine: Engine | null = null;
  let dark = $state(false);
  let resetToken = $state(0);
  let copied = $state(false);
  let playing = $state(false);
  let sheet = $state(false); // mobile: controls sheet open
  let testPrint = $state(false);
  const repoUrl = import.meta.env.VITE_REPO_URL as string | undefined;

  const result = $derived(app.result);
  const errors = $derived((result?.issues ?? []).filter((i) => i.level === 'error'));
  const failures = $derived(result?.report?.failures ?? []);
  const canDownload = $derived(!!result?.meshes && errors.length === 0 && failures.length === 0 && !app.error);
  const axis = $derived<[number, number] | null>(result?.shift ? [result.shift[0], result.shift[1] + result.hy] : null);
  const size = $derived(result?.report?.size ?? null); // bed frame: x length, y height (thickness), z width
  const grams = $derived(result?.report ? result.report.volumeCm3 * 1.24 : 0);

  onMount(() => {
    // Params from a share link
    if (location.hash.length > 1) {
      const input = decodeParams(location.hash);
      app.params = parseParams(input);
      if (Object.keys(input).length) app.preset = 'custom';
    }
    const mq = matchMedia('(prefers-color-scheme: dark)');
    dark = mq.matches;
    mq.addEventListener('change', (e) => (dark = e.matches));

    engine = new Engine({
      ready: () => (app.ready = true),
      result: (r) => { app.result = r; app.error = null; app.ready = true; },
      error: (m) => (app.error = m),
      busy: (b) => (app.busy = b),
    });
    request();
  });

  // Rebuild when params change (validated first, lightly debounced)
  let timer: ReturnType<typeof setTimeout> | undefined;
  function request() {
    const snap = $state.snapshot(app.params);
    const ok = ClipParamsSchema.safeParse(snap);
    if (!ok.success) { app.error = `Invalid value: ${ok.error.issues[0]?.path.join('.')} (${ok.error.issues[0]?.message})`; return; }
    engine?.request(snap);
  }
  $effect(() => {
    void JSON.stringify(app.params);
    clearTimeout(timer);
    timer = setTimeout(request, 60);
  });

  // Keep the share link in the address bar
  let urlTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const snap = $state.snapshot(app.params);
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const q = encodeParams(snap);
      history.replaceState(null, '', q === 'v=1' ? location.pathname : `#${q}`);
    }, 300);
  });

  function download() {
    if (!result?.meshes) return;
    save(toBinaryStl([result.meshes.base, result.meshes.arm], 'Bricko cable clip - print on its side'), fileName(result.params));
  }

  function save(bytes: Uint8Array, name: string) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'model/stl' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function downloadTestPrint() {
    if (!engine) throw new Error('Engine not ready');
    const snap = $state.snapshot(app.params);
    const r = await engine.coupon(snap);
    if (!r.ok) throw new Error(r.failures[0] ?? 'Could not build the test print');
    save(toBinaryStl([r.meshes.base, r.meshes.arm], 'Bricko test print - print on its side'), `bricko_testprint_c${String(snap.clearance).replace('.', 'p')}.stl`);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      prompt('Copy this link', location.href);
    }
  }

  function playOpen() {
    if (playing) return;
    playing = true;
    const t0 = performance.now();
    const from = app.openAngle > 60 ? app.openAngle : 0;
    const to = from > 60 ? 0 : 120;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1100);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      app.openAngle = from + (to - from) * e;
      if (k < 1) requestAnimationFrame(step);
      else playing = false;
    };
    requestAnimationFrame(step);
  }
</script>

<div class="app">
  <header>
    <a class="brand" href="./" aria-label="Bricko home">
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <rect x="6" y="30" width="52" height="20" rx="4" fill="#f2b233" />
        <rect x="12" y="22" width="10" height="8" rx="2" fill="#f2b233" />
        <rect x="27" y="22" width="10" height="8" rx="2" fill="#f2b233" />
        <rect x="42" y="22" width="10" height="8" rx="2" fill="#f2b233" />
        <path d="M10 50 Q10 58 18 58 H46 Q54 58 54 50" fill="none" stroke="#3d7be6" stroke-width="6" stroke-linecap="round" />
      </svg>
      <span class="name">Bricko</span>
    </a>
    <span class="tag">Brick-compatible cable clips, made to measure</span>
    <span class="spacer"></span>
    {#if repoUrl}<a class="ghost" href={repoUrl} target="_blank" rel="noopener">Source</a>{/if}
  </header>

  <main class="stage">
    <Viewer
      meshes={result?.meshes ?? null} {axis} width={result?.W ?? 0}
      mode={app.view} angle={app.openAngle} section={app.section} {dark} {resetToken}
    />

    <div class="toolbar">
      <div class="seg" role="radiogroup" aria-label="View">
        <button role="radio" aria-checked={app.view === 'use'} class:on={app.view === 'use'} onclick={() => (app.view = 'use')}>In use</button>
        <button role="radio" aria-checked={app.view === 'print'} class:on={app.view === 'print'} onclick={() => (app.view = 'print')}>As printed</button>
      </div>
      <label class="slider">
        <span>Open</span>
        <input type="range" min="0" max="170" step="1" bind:value={app.openAngle} aria-label="Opening angle" />
        <button class="mini" onclick={playOpen} disabled={playing} aria-label="Animate opening">▶</button>
      </label>
      <label class="slider">
        <span>Cut</span>
        <input type="range" min="0.02" max="1" step="0.01" bind:value={app.section} aria-label="Section cut through the width" />
      </label>
      <button class="mini" onclick={() => resetToken++} aria-label="Reset view" title="Reset view">⟲</button>
    </div>

    <div class="status" class:show={app.busy || !app.ready}>
      <span class="spinner" aria-hidden="true"></span>
      {app.ready ? 'Building…' : 'Loading geometry engine…'}
    </div>

    {#if errors.length && !app.busy}
      <div class="blocked">
        <strong>This combination can't be built</strong>
        <span>Adjust the highlighted settings.</span>
      </div>
    {/if}

    <div class="dock">
      {#if size}
        <div class="stats">
          <span><b>{size[0].toFixed(1)}</b> × <b>{size[2].toFixed(1)}</b> × <b>{size[1].toFixed(1)}</b> mm</span>
          <span><b>{grams.toFixed(1)}</b> g solid</span>
          <span title="Smallest gap between the two parts">gap <b>{result?.report?.minGap.toFixed(2)}</b> mm</span>
          <span class="dim">{result?.ms.toFixed(0)} ms</span>
        </div>
      {/if}
      <div class="actions">
        <button class="secondary" onclick={() => (testPrint = true)} title="Five small clips to find your printer's best fit">Test print</button>
        <button class="secondary" onclick={share}>{copied ? 'Link copied' : 'Share link'}</button>
        <button class="primary" onclick={download} disabled={!canDownload}>Download STL</button>
      </div>
    </div>
  </main>

  <aside class:open={sheet}>
    <button class="sheet-handle" onclick={() => (sheet = !sheet)} aria-expanded={sheet}>
      <span></span>{sheet ? 'Hide settings' : 'Settings'}
    </button>
    <div class="aside-body">
      {#if app.error}<p class="err">{app.error}</p>{/if}
      <Issues issues={result?.issues ?? []} {failures} />
      <Controls />
      <Guide />
      <footer>
        <p>
          <strong>Bricko</strong> is free software (AGPL-3.0). Clips are generated in your browser; nothing is uploaded.
        </p>
        <p>
          Inspired by "Cable Organizer Clip (Brick ver)" by a MakerWorld designer. Bricko's geometry is its own, built from scratch.
        </p>
        <p class="legal">
          LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this site. "Brick-compatible" means it fits standard 8 mm-pitch construction bricks.
        </p>
      </footer>
    </div>
  </aside>
</div>

{#if testPrint}
  <TestPrint onclose={() => (testPrint = false)} ondownload={downloadTestPrint} />
{/if}

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') testPrint = false; }} />

<style>
  .app {
    height: 100dvh; display: grid; grid-template-columns: minmax(330px, 400px) 1fr; grid-template-rows: auto 1fr;
    grid-template-areas: 'head head' 'side stage';
  }
  header {
    grid-area: head; display: flex; align-items: center; gap: 14px; padding: 10px 18px;
    border-bottom: 1px solid var(--line); background: var(--panel);
  }
  .brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--text); }
  .name { font-weight: 750; font-size: 1.2rem; letter-spacing: -0.02em; }
  .tag { color: var(--muted); font-size: 0.88rem; }
  .spacer { flex: 1; }
  .ghost { color: var(--text); text-decoration: none; font-size: 0.88rem; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; }
  aside { grid-area: side; overflow: auto; border-right: 1px solid var(--line); background: var(--bg); }
  .aside-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
  .sheet-handle { display: none; }
  .err { margin: 0; padding: 8px 10px; border-radius: 10px; background: var(--danger-soft); color: var(--danger-ink); font-size: 0.85rem; }
  footer { font-size: 0.76rem; color: var(--muted); line-height: 1.5; padding: 4px 4px 20px; }
  footer p { margin: 0 0 8px; }
  .legal { opacity: 0.85; }

  .stage { grid-area: stage; position: relative; overflow: hidden; background: var(--stage); }
  .toolbar {
    position: absolute; top: 14px; left: 14px; right: 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    pointer-events: none;
  }
  .toolbar > * { pointer-events: auto; }
  .seg, .slider, .mini, .status, .stats {
    background: var(--glass); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--line); border-radius: 11px; box-shadow: var(--shadow-sm);
  }
  .seg { display: flex; padding: 3px; gap: 3px; }
  .seg button { border: 0; background: none; font: inherit; font-size: 0.84rem; padding: 6px 10px; border-radius: 8px; color: var(--muted); cursor: pointer; }
  .seg button.on { background: var(--panel); color: var(--text); font-weight: 600; box-shadow: var(--shadow-sm); }
  .slider { display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 12px; font-size: 0.82rem; color: var(--muted); }
  .slider input { width: 110px; accent-color: var(--accent-2); }
  .mini { border: 1px solid var(--line); background: var(--glass); color: var(--text); font-size: 0.85rem; width: 34px; height: 34px; cursor: pointer; display: grid; place-items: center; padding: 0; }
  .slider .mini { width: 26px; height: 26px; border-radius: 8px; box-shadow: none; }
  .mini:disabled { opacity: 0.5; }
  .status {
    position: absolute; top: 64px; right: 14px; display: flex; align-items: center; gap: 8px; padding: 7px 12px;
    font-size: 0.82rem; color: var(--muted); opacity: 0; transform: translateY(-4px); transition: opacity 0.2s, transform 0.2s; pointer-events: none;
  }
  .status.show { opacity: 1; transform: none; }
  .spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-strong); border-top-color: var(--accent); animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .blocked {
    position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); background: var(--panel); border: 1px solid var(--line);
    padding: 16px 20px; border-radius: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 4px; text-align: center; font-size: 0.9rem;
  }
  .blocked span { color: var(--muted); font-size: 0.85rem; }
  .dock { position: absolute; left: 14px; right: 14px; bottom: 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; justify-content: space-between; pointer-events: none; }
  .dock > * { pointer-events: auto; }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 8px 12px; font-size: 0.82rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .stats b { color: var(--text); font-weight: 650; }
  .dim { opacity: 0.7; }
  .actions { display: flex; gap: 8px; margin-left: auto; }
  .primary, .secondary { font: inherit; font-weight: 650; font-size: 0.92rem; border-radius: 11px; padding: 11px 18px; cursor: pointer; border: 1px solid transparent; }
  .primary { background: var(--accent); color: #1d1606; box-shadow: 0 6px 18px -6px var(--accent); }
  .primary:hover:not(:disabled) { filter: brightness(1.05); }
  .primary:disabled { background: var(--line-strong); color: var(--muted); box-shadow: none; cursor: not-allowed; }
  .secondary { background: var(--glass); color: var(--text); border-color: var(--line); backdrop-filter: blur(10px); }

  @media (max-width: 860px) {
    .app { grid-template-columns: 1fr; grid-template-rows: auto 1fr; grid-template-areas: 'head' 'stage'; }
    .tag { display: none; }
    aside {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; max-height: 82dvh; border-right: 0;
      border-top: 1px solid var(--line); border-radius: 18px 18px 0 0; box-shadow: 0 -10px 30px -12px #0005;
      transform: translateY(calc(100% - 52px)); transition: transform 0.28s ease; display: flex; flex-direction: column;
    }
    aside.open { transform: none; }
    .sheet-handle {
      display: flex; flex-direction: column; align-items: center; gap: 6px; border: 0; background: var(--panel); color: var(--text);
      font: inherit; font-weight: 650; font-size: 0.9rem; padding: 8px 0 12px; border-radius: 18px 18px 0 0; cursor: pointer; flex: none;
    }
    .sheet-handle span { width: 38px; height: 4px; border-radius: 4px; background: var(--line-strong); }
    .aside-body { overflow: auto; }
    .dock { bottom: 64px; }
    .slider input { width: 80px; }
  }
</style>
