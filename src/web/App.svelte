<script lang="ts">
  import { onMount } from 'svelte';
  import { ClipParamsSchema, parseParams } from '../params/schema.ts';
  import { toBinaryStl } from '../export/stl.ts';
  import { app } from './lib/state.svelte.ts';
  import { Engine } from './lib/engine.ts';
  import { decodeState, encodeState } from './lib/url.ts';
  import { DEFAULT_CABLES, ROOM, cablesToParams } from './lib/cables.ts';
  import { fileName } from './lib/names.ts';
  import Viewer from './components/Viewer.svelte';
  import Simple from './components/Simple.svelte';
  import Advanced from './components/Advanced.svelte';
  import Issues from './components/Issues.svelte';
  import Guide from './components/Guide.svelte';
  import TestPrint from './components/TestPrint.svelte';

  let engine: Engine | null = null;
  let dark = $state(false);
  let resetToken = $state(0);
  let copied = $state(false);
  let playing = $state(false);
  let sheet = $state(false); // phones: settings sheet open
  let guideOpen = $state(false);
  const repoUrl = import.meta.env.VITE_REPO_URL as string | undefined;

  const result = $derived(app.result);
  const issues = $derived(result?.issues ?? []);
  const errors = $derived(issues.filter((i) => i.level === 'error'));
  const failures = $derived(result?.report?.failures ?? []);
  const canDownload = $derived(!!result?.meshes && errors.length === 0 && failures.length === 0 && !app.error && !app.busy);
  const axis = $derived<[number, number] | null>(result?.shift ? [result.shift[0], result.shift[1] + result.hy] : null);
  const size = $derived(result?.report?.size ?? null); // bed frame: x length, y height, z width
  const grams = $derived(result?.report ? result.report.volumeCm3 * 1.24 : 0);
  const isOpen = $derived(app.openAngle > 60);
  // cables lying on each channel floor, in the bed frame, for the desk view
  const cableShapes = $derived.by(() => {
    if (!result?.shift || result.channels.length !== app.cables.length) return [];
    const [sx, sy] = result.shift;
    return result.channels.map((ch, i) => {
      const r = Math.min(app.cables[i]!.d, ch.x1 - ch.x0) / 2;
      return { x: (ch.x0 + ch.x1) / 2 + sx, y: result.tb + r + sy, r };
    });
  });

  onMount(() => {
    if (location.hash.length > 1) {
      const s = decodeState(location.hash);
      if (s.cables) app.cables = s.cables;
      if (s.room !== undefined) app.room = s.room;
      app.params = parseParams({ ...s.params, ...cablesToParams(app.cables, app.room) });
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

  // Cables -> channel sizes
  $effect(() => {
    const p = cablesToParams($state.snapshot(app.cables), app.room);
    const cur = app.params;
    if (cur.channelCount !== p.channelCount || cur.channelHeight !== p.channelHeight || JSON.stringify(cur.channelWidths) !== JSON.stringify(p.channelWidths)) {
      Object.assign(app.params, p);
    }
  });

  // Rebuild when settings change (validated first, lightly debounced)
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
    const p = $state.snapshot(app.params), c = $state.snapshot(app.cables), r = app.room;
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const q = encodeState(p, c, r, { cables: DEFAULT_CABLES, room: ROOM.easy });
      history.replaceState(null, '', q === 'v=1' ? location.pathname : `#${q}`);
    }, 300);
  });

  function save(bytes: Uint8Array, name: string) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'model/stl' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function toast(msg: string) {
    app.toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (app.toast = null), 7000);
  }

  function download() {
    if (!result?.meshes) return;
    save(toBinaryStl([result.meshes.base, result.meshes.arm], 'Bricko cable clip - print on its side'), fileName(result.params, $state.snapshot(app.cables)));
    toast('Downloaded. Print it exactly as it is in the file: lying on its side, no supports.');
  }

  async function downloadTestPrint() {
    if (!engine) throw new Error('Still loading, try again in a second.');
    const snap = $state.snapshot(app.params);
    const r = await engine.coupon(snap);
    if (!r.ok) throw new Error(r.failures[0] ?? 'Could not build the test print.');
    save(toBinaryStl([r.meshes.base, r.meshes.arm], 'Bricko fit test - print on its side'), `bricko_fit-test.stl`);
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

  function toggleOpen() {
    if (playing) return;
    playing = true;
    const t0 = performance.now();
    const from = app.openAngle;
    const to = isOpen ? 0 : 120;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
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
    <span class="tag">Cable clips that snap onto building bricks</span>
    <span class="spacer"></span>
    <button class="ghost" onclick={() => { guideOpen = true; sheet = true; }}>How to print</button>
    {#if repoUrl}<a class="ghost hide-sm" href={repoUrl} target="_blank" rel="noopener">Source</a>{/if}
  </header>

  <main class="stage">
    <Viewer
      meshes={result?.meshes ?? null} {axis} width={result?.W ?? 0}
      mode={app.view} angle={app.openAngle} section={app.section} {dark} {resetToken} cables={cableShapes}
    />

    <div class="toolbar">
      <div class="seg" role="radiogroup" aria-label="View">
        <button role="radio" aria-checked={app.view === 'use'} class:on={app.view === 'use'} onclick={() => (app.view = 'use')}>On your desk</button>
        <button role="radio" aria-checked={app.view === 'print'} class:on={app.view === 'print'} onclick={() => (app.view = 'print')}>On the printer</button>
      </div>
      <button class="pill" onclick={toggleOpen} disabled={playing || !result?.meshes}>{isOpen ? 'Close lid' : 'Open lid'}</button>
      <button class="pill icon" onclick={() => resetToken++} aria-label="Reset view" title="Reset view">⟲</button>
    </div>

    <div class="status" class:show={app.busy || !app.ready}>
      <span class="spinner" aria-hidden="true"></span>
      {app.ready ? 'Updating…' : 'Loading…'}
    </div>

    {#if errors.length && !app.busy}
      <div class="blocked">
        <strong>This clip can't be made</strong>
        <span>{errors[0]?.message}</span>
      </div>
    {/if}

    {#if app.toast}
      <div class="toast" role="status">
        <span>{app.toast}</span>
        <button onclick={() => { guideOpen = true; sheet = true; app.toast = null; }}>Printing tips</button>
      </div>
    {/if}

    <div class="dock">
      {#if size}
        <div class="stats" aria-label="Clip size">
          <span><b>{size[0].toFixed(0)}</b> × <b>{size[2].toFixed(0)}</b> × <b>{size[1].toFixed(0)}</b> mm</span>
          <span>about <b>{Math.max(1, Math.round(grams))}</b> g of filament</span>
        </div>
      {/if}
      <div class="actions">
        <button class="secondary" onclick={share}>{copied ? 'Link copied ✓' : 'Share'}</button>
        <button class="primary" onclick={download} disabled={!canDownload}>
          Download STL
        </button>
      </div>
    </div>
  </main>

  <aside class:open={sheet}>
    <button class="sheet-handle" onclick={() => (sheet = !sheet)} aria-expanded={sheet}>
      <span></span>{sheet ? 'Show preview' : 'Customize'}
    </button>
    <div class="aside-body">
      <p class="intro">Pick your cables, download, and print. Every clip folds shut on a built-in hinge, with no assembly.</p>
      {#if app.error}<p class="err">{app.error}</p>{/if}
      <Issues issues={errors} {failures} />
      <Simple />
      <Advanced />
      <Guide bind:open={guideOpen} />
      <button class="primary sheet-cta" onclick={() => { download(); sheet = false; }} disabled={!canDownload}>Download STL</button>
      <footer>
        <p><strong>Bricko</strong> is free and open source (AGPL-3.0). Everything runs in your browser, so nothing is uploaded.</p>
        {#if repoUrl}<p><a href={repoUrl} target="_blank" rel="noopener">Source code and feedback</a></p>{/if}
      </footer>
    </div>
  </aside>
</div>

{#if app.testPrint}
  <TestPrint onclose={() => (app.testPrint = false)} ondownload={downloadTestPrint} />
{/if}

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') app.testPrint = false; }} />

<style>
  .app {
    height: 100dvh; display: grid; grid-template-columns: minmax(330px, 390px) 1fr; grid-template-rows: auto 1fr;
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
  .ghost { color: var(--text); text-decoration: none; font: inherit; font-size: 0.86rem; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: none; cursor: pointer; }
  aside { grid-area: side; overflow: auto; border-right: 1px solid var(--line); background: var(--bg); }
  .aside-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
  .intro { margin: 0; font-size: 0.9rem; line-height: 1.45; color: var(--muted); }
  .sheet-handle, .sheet-cta { display: none; }
  .err { margin: 0; padding: 8px 10px; border-radius: 10px; background: var(--danger-soft); color: var(--danger-ink); font-size: 0.85rem; }
  footer { font-size: 0.78rem; color: var(--muted); line-height: 1.5; padding: 4px 4px 20px; }
  footer p { margin: 0 0 6px; }
  footer a { color: var(--accent-ink); }

  .stage { grid-area: stage; position: relative; overflow: hidden; background: var(--stage); }
  .toolbar { position: absolute; top: 14px; left: 14px; right: 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; pointer-events: none; }
  .toolbar > * { pointer-events: auto; }
  .seg, .pill, .status, .stats, .toast {
    background: var(--glass); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--line); border-radius: 11px; box-shadow: var(--shadow-sm);
  }
  .seg { display: flex; padding: 3px; gap: 3px; }
  .seg button { border: 0; background: none; font: inherit; font-size: 0.86rem; padding: 6px 11px; border-radius: 8px; color: var(--muted); cursor: pointer; }
  .seg button.on { background: var(--panel); color: var(--text); font-weight: 600; box-shadow: var(--shadow-sm); }
  .pill { font: inherit; font-size: 0.86rem; font-weight: 600; color: var(--text); padding: 8px 14px; cursor: pointer; }
  .pill.icon { width: 38px; padding: 8px 0; font-weight: 400; }
  .pill:disabled { opacity: 0.5; cursor: default; }
  .status {
    position: absolute; top: 66px; right: 14px; display: flex; align-items: center; gap: 8px; padding: 7px 12px;
    font-size: 0.82rem; color: var(--muted); opacity: 0; transform: translateY(-4px); transition: opacity 0.2s, transform 0.2s; pointer-events: none;
  }
  .status.show { opacity: 1; transform: none; }
  .spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-strong); border-top-color: var(--accent); animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .blocked {
    position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: min(380px, calc(100% - 28px)); background: var(--panel); border: 1px solid var(--line);
    padding: 16px 20px; border-radius: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 6px; text-align: center; font-size: 0.92rem;
  }
  .blocked span { color: var(--muted); font-size: 0.86rem; }
  .toast {
    position: absolute; left: 50%; bottom: 84px; transform: translateX(-50%); width: min(520px, calc(100% - 28px)); padding: 12px 14px;
    display: flex; gap: 12px; align-items: center; font-size: 0.88rem; background: var(--panel); box-shadow: var(--shadow); animation: up 0.25s ease;
  }
  .toast span { flex: 1; line-height: 1.4; }
  .toast button { border: 0; background: var(--warn-soft); color: var(--accent-ink); font: inherit; font-weight: 650; padding: 7px 10px; border-radius: 8px; cursor: pointer; white-space: nowrap; }
  @keyframes up { from { opacity: 0; transform: translate(-50%, 8px); } }
  .dock { position: absolute; left: 14px; right: 14px; bottom: 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; justify-content: space-between; pointer-events: none; }
  .dock > * { pointer-events: auto; }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 9px 13px; font-size: 0.85rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .stats b { color: var(--text); font-weight: 650; }
  .actions { display: flex; gap: 8px; margin-left: auto; }
  .primary, .secondary { font: inherit; font-weight: 650; font-size: 0.95rem; border-radius: 12px; padding: 12px 20px; cursor: pointer; border: 1px solid transparent; }
  .primary { background: var(--accent); color: #1d1606; box-shadow: 0 6px 18px -6px var(--accent); }
  .primary:hover:not(:disabled) { filter: brightness(1.05); }
  .primary:disabled { background: var(--line-strong); color: var(--muted); box-shadow: none; cursor: not-allowed; }
  .secondary { background: var(--glass); color: var(--text); border-color: var(--line); backdrop-filter: blur(10px); }

  @media (max-width: 860px) {
    .app { grid-template-columns: 1fr; grid-template-rows: auto 1fr; grid-template-areas: 'head' 'stage'; }
    .tag, .hide-sm { display: none; }
    aside {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; max-height: 86dvh; border-right: 0;
      border-top: 1px solid var(--line); border-radius: 18px 18px 0 0; box-shadow: 0 -10px 30px -12px #0005;
      transform: translateY(calc(100% - 52px)); transition: transform 0.28s ease; display: flex; flex-direction: column;
    }
    aside.open { transform: none; }
    .sheet-handle {
      display: flex; flex-direction: column; align-items: center; gap: 6px; border: 0; background: var(--panel); color: var(--text);
      font: inherit; font-weight: 650; font-size: 0.92rem; padding: 8px 0 12px; border-radius: 18px 18px 0 0; cursor: pointer; flex: none;
    }
    .sheet-handle span { width: 38px; height: 4px; border-radius: 4px; background: var(--line-strong); }
    .aside-body { overflow: auto; }
    .sheet-cta { display: block; position: sticky; bottom: 0; width: 100%; z-index: 2; }
    .dock { bottom: 64px; }
    .toast { bottom: 140px; }
    .primary, .secondary { padding: 11px 16px; }
  }
</style>
