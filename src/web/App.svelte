<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { ClipParamsSchema, parseParams } from '../params/schema.ts';
  import { toBinaryStl } from '../export/stl.ts';
  import { app } from './lib/state.svelte.ts';
  import { Engine } from './lib/engine.ts';
  import { decodeState, encodeState } from './lib/url.ts';
  import { DEFAULT_CABLES, ROOM, cablesToParams } from './lib/cables.ts';
  import { fileName } from './lib/names.ts';
  import { issueText, paramLabel, t } from './i18n/index.svelte.ts';
  import { FIELD_BY_KEY, type ParamKey } from './lib/fields.ts';
  import Rich from './components/Rich.svelte';
  import Viewer from './components/Viewer.svelte';
  import Simple from './components/Simple.svelte';
  import Advanced from './components/Advanced.svelte';
  import Issues from './components/Issues.svelte';
  import Guide from './components/Guide.svelte';
  import TestPrint from './components/TestPrint.svelte';

  /**
   * Three layouts, picked from the window:
   *   desk   settings beside a big preview
   *   side   the same idea, packed tighter: phones on their side, small tablets
   *   sheet  phones held upright: the preview fills the screen and the settings are a sheet dragged over it
   * In `side` and `sheet` the Download bar is always on screen and the preview frames the clip in whatever isn't covered.
   */
  type Layout = 'desk' | 'side' | 'sheet';
  const SHEET_MQ = '(max-width: 699.98px) and (orientation: portrait), (max-width: 559.98px)';
  const SIDE_MQ = '(max-width: 899.98px), (max-height: 519.98px)';
  const pickLayout = (): Layout => (matchMedia(SHEET_MQ).matches ? 'sheet' : matchMedia(SIDE_MQ).matches ? 'side' : 'desk');
  let layout = $state<Layout>(pickLayout());

  let engine: Engine | null = null;
  let dark = $state(false);
  let resetToken = $state(0);
  let copied = $state(false);
  let playing = $state(false);
  let guideOpen = $state(false);
  let guideToken = $state(0);
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

  // ---- The settings sheet (phones held upright) ----
  // It rests at three stops. Its height is driven from here, so the preview can keep the clip centred above it.
  type Detent = 'peek' | 'half' | 'full';
  const DETENTS: Detent[] = ['peek', 'half', 'full'];
  const PEEK = 52; // just the handle
  let detent = $state<Detent>('half');
  let stageH = $state(0);
  const sheet = new Tween(0, { duration: 0 });
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  function heightOf(d: Detent): number {
    if (d === 'peek') return PEEK;
    if (d === 'full') return Math.max(PEEK, stageH);
    // about half, but leave a preview worth looking at on short screens
    return Math.round(Math.max(PEEK + 80, Math.min(Math.max(stageH * 0.52, 230), stageH - 220)));
  }
  function snapTo(d: Detent, animate = true) {
    detent = d;
    void sheet.set(heightOf(d), { duration: animate && !calm.matches ? 260 : 0, easing: cubicOut });
  }
  // The stage changed size (turned phone, keyboard, browser bars): stay on the same stop
  $effect(() => {
    void stageH; void layout;
    untrack(() => snapTo(detent, false));
  });

  let drag: { id: number; y0: number; h0: number; moved: boolean; y: number; t: number; v: number } | null = null;
  let handledAt = 0; // when a pointer last finished on the handle
  function grab(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, y0: e.clientY, h0: sheet.current, moved: false, y: e.clientY, t: e.timeStamp, v: 0 };
  }
  function dragTo(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const up = drag.y0 - e.clientY;
    if (!drag.moved && Math.abs(up) < 6) return;
    drag.moved = true;
    const dt = e.timeStamp - drag.t;
    if (dt > 0) drag.v = 0.6 * drag.v + 0.4 * ((drag.y - e.clientY) / dt); // px/ms, + is up
    drag.y = e.clientY; drag.t = e.timeStamp;
    void sheet.set(Math.min(Math.max(PEEK, stageH), Math.max(PEEK, drag.h0 + up)), { duration: 0 });
  }
  function release(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    handledAt = performance.now();
    if (!d.moved) { if (e.type === 'pointerup') toggleSheet(); return; }
    const h = sheet.current;
    const stops = DETENTS.map((s) => ({ s, h: heightOf(s) }));
    let to = stops.reduce((a, b) => (Math.abs(b.h - h) < Math.abs(a.h - h) ? b : a)).s;
    // a flick goes to the next stop in that direction, wherever the finger let go
    if (d.v > 0.4) to = stops.find((x) => x.h > h + 1)?.s ?? 'full';
    else if (d.v < -0.4) to = [...stops].reverse().find((x) => x.h < h - 1)?.s ?? 'peek';
    snapTo(to);
  }
  const toggleSheet = () => snapTo(detent === 'peek' ? 'half' : 'peek');
  // Keyboards and screen readers click without a pointer; taps were already handled on release
  function clickHandle() {
    if (performance.now() - handledAt > 400) toggleSheet();
  }
  function keyHandle(e: KeyboardEvent) {
    const step = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    snapTo(DETENTS[Math.min(2, Math.max(0, DETENTS.indexOf(detent) + step))]!);
  }

  const sheetPx = $derived(layout === 'sheet' && stageH ? sheet.current : 0);
  // the sheet is (nearly) over the whole preview: its floating controls go away
  const covered = $derived(layout === 'sheet' && stageH > 0 && stageH - sheet.current < 150);
  // what the preview's own controls and the sheet cover, top and bottom
  const inset = $derived(layout === 'desk' ? { top: 0, bottom: 0 } : { top: 56, bottom: 60 + sheetPx });

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
    for (const q of [SHEET_MQ, SIDE_MQ]) matchMedia(q).addEventListener('change', () => (layout = pickLayout()));
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
    if (!ok.success) {
      // the field by its name in the visitor's language; the validator's own detail stays as it is
      const bad = ok.error.issues[0];
      const key = String(bad?.path[0] ?? '');
      app.error = `${t('error.invalid', { field: key in FIELD_BY_KEY ? paramLabel(key as ParamKey) : key })} (${bad?.message})`;
      return;
    }
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
      history.replaceState(null, '', location.pathname + location.search + (q === 'v=1' ? '' : `#${q}`)); // keeps ?lang=
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
    toast(t('toast.downloaded'));
  }

  async function downloadTestPrint() {
    if (!engine) throw new Error(t('error.loading'));
    const snap = $state.snapshot(app.params);
    const r = await engine.coupon(snap);
    if (!r.ok) throw new Error(r.failures[0] ?? t('error.testPrint'));
    save(toBinaryStl([r.meshes.base, r.meshes.arm], 'Bricko fit test - print on its side'), `bricko_fit-test.stl`);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      prompt(t('share.prompt'), location.href);
    }
  }
  async function share() {
    // On a phone or tablet, the system share sheet (messages, AirDrop, notes…) beats a silent copy
    if (matchMedia('(pointer: coarse)').matches && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('share.title'), url: location.href });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // closed the share sheet
      }
    }
    await copyLink();
  }

  function openGuide() {
    guideOpen = true;
    guideToken++;
    if (layout === 'sheet') snapTo('full');
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

{#snippet lidButton()}
  <button class="pill" onclick={toggleOpen} disabled={playing || !result?.meshes}>{isOpen ? t('view.closeLid') : t('view.openLid')}</button>
{/snippet}

{#snippet stats()}
  {#if size}
    <div class="stats" aria-label={t('stats.label')}>
      <span><b>{size[0].toFixed(0)}</b> × <b>{size[2].toFixed(0)}</b> × <b>{size[1].toFixed(0)}</b> mm</span>
      <span><Rich text={t(layout === 'desk' ? 'stats.filament' : 'stats.filamentShort', { g: Math.max(1, Math.round(grams)) })} /></span>
    </div>
  {/if}
{/snippet}

{#snippet actions()}
  <div class="actions">
    <button class="secondary" onclick={share}>{copied ? t('share.copied') : t('share.button')}</button>
    <button class="primary" onclick={download} disabled={!canDownload}>{t('download.button')}</button>
  </div>
{/snippet}

{#snippet toastView()}
  {#if app.toast}
    <div class="toast" role="status">
      <span>{app.toast}</span>
      <button class="tips" onclick={() => { openGuide(); app.toast = null; }}>{t('toast.tips')}</button>
      <button class="dismiss" onclick={() => (app.toast = null)} aria-label={t('toast.dismiss')}>✕</button>
    </div>
  {/if}
{/snippet}

<div class="app {layout}" style:--sheet-h={layout === 'sheet' && stageH ? `${sheet.current}px` : null}>
  <header>
    <a class="brand" href="./" aria-label={t('app.home')}>
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <rect x="6" y="30" width="52" height="20" rx="4" fill="#f2b233" />
        <rect x="12" y="22" width="10" height="8" rx="2" fill="#f2b233" />
        <rect x="27" y="22" width="10" height="8" rx="2" fill="#f2b233" />
        <rect x="42" y="22" width="10" height="8" rx="2" fill="#f2b233" />
        <path d="M10 50 Q10 58 18 58 H46 Q54 58 54 50" fill="none" stroke="#3d7be6" stroke-width="6" stroke-linecap="round" />
      </svg>
      <span class="name">Bricko</span>
    </a>
    <span class="tag">{t('app.tagline')}</span>
    <span class="spacer"></span>
    <button class="ghost" onclick={openGuide}>{t('app.howToPrint')}</button>
    {#if repoUrl}<a class="ghost source" href={repoUrl} target="_blank" rel="noopener">{t('app.source')}</a>{/if}
  </header>

  <main class="stage" bind:clientHeight={stageH}>
    <Viewer
      meshes={result?.meshes ?? null} {axis} width={result?.W ?? 0}
      mode={app.view} angle={app.openAngle} section={app.section} {dark} {resetToken} cables={cableShapes}
      {inset} tight={layout !== 'desk'} label={t('view.preview')}
    />

    <div class="toolbar" inert={covered}>
      <div class="seg" role="radiogroup" aria-label={t('view.label')}>
        <button role="radio" aria-checked={app.view === 'use'} class:on={app.view === 'use'} onclick={() => (app.view = 'use')}>{t('view.desk')}</button>
        <button role="radio" aria-checked={app.view === 'print'} class:on={app.view === 'print'} onclick={() => (app.view = 'print')}>{t('view.printer')}</button>
      </div>
      {#if layout === 'desk'}{@render lidButton()}{/if}
      <button class="pill icon" onclick={() => resetToken++} aria-label={t('view.reset')} title={t('view.reset')}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M6.7 2.7v4h4" />
        </svg>
      </button>
    </div>

    <div class="status" class:show={app.busy || !app.ready} class:boot={!app.ready}>
      <span class="spinner" aria-hidden="true"></span>
      {app.ready ? t('status.updating') : t('status.loading')}
    </div>

    {#if errors.length && !app.busy}
      <div class="blocked">
        <strong>{t('blocked.title')}</strong>
        <span>{errors[0] ? issueText(errors[0]) : ''}</span>
      </div>
    {/if}

    {#if layout === 'desk'}
      {@render toastView()}
      <div class="dock">
        {@render stats()}
        {@render actions()}
      </div>
    {:else}
      <div class="hud" inert={covered}>
        {@render lidButton()}
        {@render stats()}
      </div>
    {/if}
  </main>

  <aside class:peek={detent === 'peek'} aria-label={t('panel.label')}>
    {#if layout === 'sheet'}
      <button
        class="handle" aria-expanded={detent !== 'peek'} aria-controls="settings"
        onpointerdown={grab} onpointermove={dragTo} onpointerup={release} onpointercancel={release}
        onclick={clickHandle} onkeydown={keyHandle}
      >
        <span class="grip" aria-hidden="true"></span>
        <span class="handle-label">{t('panel.customize')}<span class="chev" aria-hidden="true"></span></span>
      </button>
    {/if}
    <div class="aside-body" id="settings" inert={layout === 'sheet' && detent === 'peek'}>
      <p class="intro">{t('app.intro')}</p>
      {#if app.error}<p class="err">{app.error}</p>{/if}
      <Issues issues={errors} {failures} />
      <Simple />
      <Advanced />
      <Guide bind:open={guideOpen} token={guideToken} />
      <footer>
        <p><Rich text={t('footer.about')} /></p>
        {#if repoUrl}<p><a href={repoUrl} target="_blank" rel="noopener">{t('footer.source')}</a></p>{/if}
      </footer>
    </div>
  </aside>

  {#if layout !== 'desk'}
    <div class="bar">
      {@render toastView()}
      {@render actions()}
    </div>
  {/if}
</div>

{#if app.testPrint}
  <TestPrint onclose={() => (app.testPrint = false)} ondownload={downloadTestPrint} />
{/if}

<style>
  .app {
    height: 100dvh; display: grid; grid-template-columns: minmax(330px, 390px) 1fr; grid-template-rows: auto 1fr;
    grid-template-areas: 'head head' 'side stage';
  }
  header {
    grid-area: head; display: flex; align-items: center; gap: 14px;
    padding: calc(10px + var(--safe-t)) max(18px, var(--safe-r)) 10px max(18px, var(--safe-l));
    border-bottom: 1px solid var(--line); background: var(--panel);
  }
  .brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--text); min-height: var(--tap); min-width: var(--tap); }
  .name { font-weight: 750; font-size: 1.2rem; letter-spacing: -0.02em; }
  .tag { color: var(--muted); font-size: 0.88rem; }
  .spacer { flex: 1; }
  .ghost {
    display: inline-flex; align-items: center; min-height: var(--tap); color: var(--text); text-decoration: none; font: inherit; font-size: 0.86rem;
    padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: none; cursor: pointer; white-space: nowrap;
  }
  /* min-width/height 0: a grid item is otherwise as big as its widest content (a long cable name), and pushes the app off the screen */
  aside { grid-area: side; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; border-right: 1px solid var(--line); background: var(--bg); }
  .aside-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
  .intro { margin: 0; font-size: 0.9rem; line-height: 1.45; color: var(--muted); }
  .err { margin: 0; padding: 8px 10px; border-radius: 10px; background: var(--danger-soft); color: var(--danger-ink); font-size: 0.85rem; }
  footer { font-size: 0.78rem; color: var(--muted); line-height: 1.5; padding: 4px 4px 20px; }
  footer p { margin: 0 0 6px; }
  footer a { color: var(--accent-ink); }

  .stage { grid-area: stage; position: relative; overflow: hidden; min-width: 0; min-height: 0; background: var(--stage); }
  .toolbar { position: absolute; top: 14px; left: 14px; right: 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; pointer-events: none; }
  .toolbar > * { pointer-events: auto; }
  .seg, .pill, .status, .stats, .toast {
    background: var(--glass); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--line); border-radius: 11px; box-shadow: var(--shadow-sm);
  }
  .seg { display: flex; padding: 3px; gap: 3px; }
  .seg button {
    border: 0; background: none; font: inherit; font-size: 0.86rem; padding: 6px 11px; border-radius: 8px; color: var(--muted); cursor: pointer;
    min-height: calc(var(--tap) - 8px); white-space: nowrap;
  }
  .seg button.on { background: var(--panel); color: var(--text); font-weight: 600; box-shadow: var(--shadow-sm); }
  .pill { font: inherit; font-size: 0.86rem; font-weight: 600; color: var(--text); padding: 8px 14px; cursor: pointer; min-height: var(--tap); white-space: nowrap; }
  .pill.icon { width: 38px; min-width: var(--tap); padding: 8px 0; display: inline-grid; place-items: center; }
  .pill:disabled { opacity: 0.5; cursor: default; }
  .status {
    position: absolute; top: 66px; right: 14px; display: flex; align-items: center; gap: 8px; padding: 7px 12px;
    font-size: 0.82rem; color: var(--muted); opacity: 0; transform: translateY(-4px); transition: opacity 0.2s, transform 0.2s; pointer-events: none;
  }
  .status.show { opacity: 1; transform: none; }
  /* first load: say so where the clip is about to appear */
  .status.boot { top: calc((100% - var(--sheet-h, 0px)) / 2); right: auto; left: 50%; transform: translate(-50%, -50%); font-size: 0.92rem; padding: 10px 16px; transition: none; }
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
  .toast button { border: 0; font: inherit; border-radius: 8px; cursor: pointer; min-height: var(--tap); }
  .toast .tips { background: var(--warn-soft); color: var(--accent-ink); font-weight: 650; padding: 7px 10px; white-space: nowrap; }
  .toast .dismiss { display: none; background: none; color: var(--muted); min-width: var(--tap); margin: 0 -8px 0 -6px; }
  @keyframes up { from { opacity: 0; transform: translate(-50%, 8px); } }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
  .dock { position: absolute; left: 14px; right: 14px; bottom: 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; justify-content: space-between; pointer-events: none; }
  .dock > * { pointer-events: auto; }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 9px 13px; font-size: 0.85rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .stats :global(b) { color: var(--text); font-weight: 650; }
  .actions { display: flex; gap: 8px; margin-left: auto; }
  .primary, .secondary { font: inherit; font-weight: 650; font-size: 0.95rem; border-radius: 12px; padding: 12px 20px; cursor: pointer; border: 1px solid transparent; white-space: nowrap; }
  .primary { background: var(--accent); color: #1d1606; box-shadow: 0 6px 18px -6px var(--accent); }
  .primary:disabled { background: var(--line-strong); color: var(--muted); box-shadow: none; cursor: not-allowed; }
  .secondary { background: var(--glass); color: var(--text); border-color: var(--line); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  @media (hover: hover) {
    .primary:hover:not(:disabled) { filter: brightness(1.05); }
  }

  /* ---------- side + sheet: phones and small tablets ---------- */
  .app:not(.desk) { grid-template-rows: auto 1fr auto; }
  /* above the sheet, so its shadow never falls on the header when it is pulled all the way up */
  .app:not(.desk) header { gap: 8px; padding: calc(4px + var(--safe-t)) 12px 4px; position: relative; z-index: 7; }
  .app:not(.desk) .tag, .app:not(.desk) .source { display: none; }
  .app:not(.desk) .aside-body { padding: 12px; }
  .app:not(.desk) .toolbar { top: 10px; left: 10px; right: max(10px, var(--safe-r)); flex-wrap: nowrap; justify-content: space-between; transition: opacity 0.15s; }
  .app:not(.desk) .status:not(.boot) { top: calc(18px + max(var(--tap), 38px)); right: max(10px, var(--safe-r)); }
  .app:not(.desk) .blocked { top: calc((100% - var(--sheet-h, 0px)) / 2); padding: 12px 16px; }
  .toolbar[inert], .hud[inert] { opacity: 0; }

  /* just above the sheet: the lid button under your thumb, and how big the clip is */
  .hud {
    position: absolute; left: 10px; right: max(10px, var(--safe-r)); bottom: calc(var(--sheet-h, 0px) + 12px);
    display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; pointer-events: none; transition: opacity 0.15s;
  }
  .hud .pill { pointer-events: auto; }
  .hud .stats { gap: 0 8px; padding: 7px 10px; font-size: 0.8rem; margin-left: auto; }

  /* always on screen: share and download */
  .bar { grid-area: bar; position: relative; z-index: 6; padding: 10px 12px calc(10px + var(--safe-b)); background: var(--panel); border-top: 1px solid var(--line); }
  .bar .actions { margin: 0; }
  .bar .primary, .bar .secondary { min-height: 48px; padding: 10px 18px; }
  .bar .primary { flex: 1; }
  .bar .secondary { background: var(--input); }
  .bar .toast { left: 10px; right: 10px; bottom: calc(100% + 10px); width: auto; transform: none; animation-name: rise; padding: 10px 12px; gap: 8px; }
  .bar .toast .dismiss { display: block; flex: none; }
  /* Longer languages on small phones: wrap instead of pushing things off the screen */
  /* message and close on one line, the tips button under them: reads well at any phone width and in any language */
  .bar .toast { display: grid; grid-template-columns: 1fr auto; align-items: start; }
  .bar .toast .dismiss { grid-column: 2; grid-row: 1; margin: -6px -6px 0 0; }
  .bar .toast .tips { grid-column: 1 / -1; justify-self: start; }
  .bar .primary { white-space: normal; line-height: 1.15; min-width: 0; }
  .hud { flex-wrap: wrap-reverse; row-gap: 6px; }
  .app:not(.desk) .seg { min-width: 0; }
  .app:not(.desk) .seg button { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

  /* side: header, settings and the bar stacked in one column, the preview gets the full height */
  .app.side { grid-template-columns: clamp(280px, 42vw, 380px) minmax(0, 1fr); grid-template-areas: 'head stage' 'side stage' 'bar stage'; }
  .app.side header, .app.side .bar { border-right: 1px solid var(--line); padding-left: max(12px, var(--safe-l)); }
  .app.side .aside-body { padding-left: max(12px, var(--safe-l)); }

  /* sheet: the settings slide over the preview */
  .app.sheet { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'head' 'stage' 'bar'; }
  .app.sheet aside {
    grid-area: stage; align-self: end; z-index: 5; height: var(--sheet-h, 52%); overflow: visible;
    display: flex; flex-direction: column; border-right: 0; border-top: 1px solid var(--line); border-radius: 18px 18px 0 0;
    box-shadow: 0 -10px 30px -12px rgb(0 0 0 / 0.35);
  }
  .app.sheet .aside-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-top: 0; }
  .handle {
    flex: none; height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
    border: 0; border-radius: 18px 18px 0 0; background: none; color: var(--text); font: inherit; font-weight: 650; font-size: 0.92rem;
    cursor: grab; touch-action: none; -webkit-touch-callout: none;
  }
  .handle:active { cursor: grabbing; opacity: 1; }
  .grip { width: 40px; height: 5px; border-radius: 5px; background: var(--line-strong); }
  .handle-label { display: flex; align-items: center; gap: 9px; }
  /* points down while the sheet is up (tap to tuck it away), up when it is tucked away */
  .chev { width: 8px; height: 8px; margin-top: -4px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(45deg); transition: transform 0.2s; }
  .peek .chev { margin-top: 4px; transform: rotate(225deg); }
</style>
