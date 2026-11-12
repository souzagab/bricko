<script lang="ts">
  import { onMount } from 'svelte';
  import { couponSpecs, type CouponSpec } from '../../coupon.ts';
  import { app } from '../lib/state.svelte.ts';
  import { num, signed, t } from '../i18n/index.svelte.ts';
  import Rich from './Rich.svelte';

  interface Props { onclose: () => void; ondownload: () => Promise<void> }
  let { onclose, ondownload }: Props = $props();
  let phase = $state<'idle' | 'busy' | 'done' | 'error'>('idle');
  let message = $state('');
  // The table must match the clips you actually printed, so it is frozen when you download
  // (and remembered in this browser), not recomputed every time a setting changes.
  const KEY = 'bricko.lastTestPrint';
  function load(): CouponSpec[] | null {
    try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return Array.isArray(v) && v.length === 5 ? v : null; }
    catch { return null; }
  }
  const saved = load();
  let fromSaved = $state(!!saved);
  let specs = $state<CouponSpec[]>(saved ?? couponSpecs($state.snapshot(app.params)));

  // A native modal dialog: the page behind it is inert, focus stays inside, and Escape
  // (or the back gesture on Android) closes it.
  let dlg: HTMLDialogElement;
  onMount(() => dlg.showModal());

  async function go() {
    phase = 'busy';
    try {
      await ondownload();
      specs = couponSpecs($state.snapshot(app.params));
      fromSaved = false;
      try { localStorage.setItem(KEY, JSON.stringify(specs)); } catch { /* private mode: fine */ }
      phase = 'done';
    } catch (e) { phase = 'error'; message = e instanceof Error ? e.message : String(e); }
  }
  function use(key: 'clearance' | 'studFit' | 'socketFit', v: number) {
    app.params[key] = v;
  }
  const dots = (n: number) => '●'.repeat(n);
</script>

<!-- Everything you can see is inside .panel, so a click that lands on the dialog itself is a click on the backdrop.
     Keyboards close it with Escape, which the dialog handles itself. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog class="dialog" bind:this={dlg} aria-labelledby="tp-title" {onclose} onclick={(e) => { if (e.target === dlg) dlg.close(); }}>
  <div class="panel">
    <header>
      <h2 id="tp-title">{t('test.title')}</h2>
      <button class="x" onclick={() => dlg.close()} aria-label={t('test.close')}>✕</button>
    </header>
    <div class="content">
      <p>{t('test.intro')}</p>
      <ol>
        <li><Rich text={t('test.hinge')} /></li>
        <li><Rich text={t('test.studs')} /></li>
        <li><Rich text={t('test.sockets')} /></li>
      </ol>
      {#if fromSaved}<p class="hint">{t('test.saved')}</p>{/if}
      <div class="table" role="table">
        <div class="tr th" role="row"><span>{t('test.colDots')}</span><span>{t('test.colHinge')}</span><span>{t('test.colStuds')}</span><span>{t('test.colSockets')}</span></div>
        {#each specs as s (s.dots)}
          <div class="tr" role="row">
            <span class="dots" aria-label={t('test.dots', { n: s.dots })}>{dots(s.dots)}</span>
            <button class:cur={s.clearance === app.params.clearance} onclick={() => use('clearance', s.clearance)}>{num(s.clearance, 2, 2)}</button>
            <button class:cur={s.studFit === app.params.studFit} onclick={() => use('studFit', s.studFit)}>{signed(s.studFit)}</button>
            <button class:cur={s.socketFit === app.params.socketFit} onclick={() => use('socketFit', s.socketFit)}>{signed(s.socketFit)}</button>
          </div>
        {/each}
      </div>
      <p class="hint">{t('test.apply')}</p>
    </div>
    <div class="foot">
      {#if phase === 'error'}<span class="err">{message}</span>{/if}
      {#if phase === 'done'}<span class="ok">{t('test.done')}</span>{/if}
      <button class="primary" onclick={go} disabled={phase === 'busy'}>{phase === 'busy' ? t('test.building') : t('test.download')}</button>
    </div>
  </div>
</dialog>

<style>
  .dialog {
    width: min(560px, calc(100vw - 24px)); max-width: none; max-height: calc(100dvh - 24px); padding: 0; overflow: hidden;
    background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 16px;
    box-shadow: var(--shadow); font-size: 0.9rem; line-height: 1.5;
  }
  .dialog[open] { display: flex; animation: pop 0.18s ease; }
  .dialog::backdrop { background: rgb(0 0 0 / 0.35); animation: fade 0.15s; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: translateY(8px); } }
  .panel { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  header { flex: none; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 10px 4px 20px; }
  h2 { margin: 0; font-size: 1.15rem; }
  .x { border: 0; background: none; color: var(--muted); font-size: 1rem; cursor: pointer; padding: 6px; min-width: max(var(--tap), 32px); min-height: max(var(--tap), 32px); border-radius: 8px; }
  .content { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 20px 4px; }
  p { margin: 10px 0; color: var(--text); }
  ol { margin: 0 0 12px; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
  .table { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .tr { display: grid; grid-template-columns: 1.1fr 1fr 1fr 1fr; align-items: stretch; border-top: 1px solid var(--line); }
  .tr:first-child { border-top: 0; }
  .th { background: var(--input); font-size: 0.75rem; font-weight: 650; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .th span { min-width: 0; overflow-wrap: anywhere; hyphens: auto; }
  .tr > * { padding: 8px 12px; display: flex; align-items: center; }
  .dots { color: var(--accent-ink); letter-spacing: 2px; font-size: 0.8rem; }
  .tr button {
    border: 0; background: none; font: inherit; color: var(--text); text-align: left; cursor: pointer;
    font-variant-numeric: tabular-nums; border-radius: 0; min-height: var(--tap);
  }
  .tr button.cur { font-weight: 750; color: var(--accent-ink); background: var(--warn-soft); }
  @media (hover: hover) {
    .tr button:hover:not(.cur) { background: var(--input); }
  }
  .hint { font-size: 0.8rem; color: var(--muted); }
  .foot { flex: none; display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; padding: 10px 20px 16px; }
  .ok { color: var(--muted); font-size: 0.84rem; }
  .err { color: var(--danger-ink); font-size: 0.84rem; }
  .primary { font: inherit; font-weight: 650; border: 0; border-radius: 11px; padding: 10px 16px; background: var(--accent); color: #1d1606; cursor: pointer; min-height: var(--tap); }
  .primary:disabled { opacity: 0.6; cursor: wait; }

  /* Phones: a sheet that rises from the bottom edge, with the download button always in reach */
  @media (max-width: 699.98px) {
    .dialog { width: 100%; max-height: calc(100dvh - 24px - var(--safe-t)); margin: auto 0 0; border-width: 1px 0 0; border-radius: 18px 18px 0 0; }
    header { padding: 10px 6px 2px 16px; }
    .content { padding: 0 16px 4px; }
    .tr > * { padding: 8px 10px; }
    .th { text-transform: none; letter-spacing: 0; font-size: 0.78rem; } /* room for longer words (Scharnier, Dobradiça) */
    .foot { padding: 10px 16px calc(12px + var(--safe-b)); border-top: 1px solid var(--line); }
    .foot .primary { flex: 1 0 100%; min-height: 48px; }
  }
</style>
