<script lang="ts">
  import { couponSpecs, type CouponSpec } from '../../coupon.ts';
  import { app } from '../lib/state.svelte.ts';

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
    app.preset = 'custom';
  }
  const dots = (n: number) => '●'.repeat(n);
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="tp-title">
  <header>
    <h2 id="tp-title">Find your printer's fit</h2>
    <button class="x" onclick={onclose} aria-label="Close">✕</button>
  </header>
  <p>
    Five small clips, each a step looser than the last, centred on your current settings.
    Clip <b>●●●</b> uses exactly what you have now. Print them on their side like a normal clip, then:
  </p>
  <ol>
    <li><b>Hinge:</b> pick the tightest clip whose hinge turns freely.</li>
    <li><b>Studs:</b> press a real brick onto each clip's studs. Pick the one that clicks and holds.</li>
    <li><b>Sockets:</b> press each clip onto a real brick or baseplate. Pick the one that grips without forcing.</li>
  </ol>
  {#if fromSaved}<p class="hint">Showing the values from your last downloaded test print.</p>{/if}
  <div class="table" role="table">
    <div class="tr th" role="row"><span>Dots</span><span>Clearance</span><span>Stud fit</span><span>Socket fit</span></div>
    {#each specs as s (s.dots)}
      <div class="tr" role="row">
        <span class="dots" aria-label="{s.dots} dots">{dots(s.dots)}</span>
        <button class:cur={s.clearance === app.params.clearance} onclick={() => use('clearance', s.clearance)}>{s.clearance.toFixed(2)}</button>
        <button class:cur={s.studFit === app.params.studFit} onclick={() => use('studFit', s.studFit)}>{s.studFit >= 0 ? '+' : ''}{s.studFit.toFixed(2)}</button>
        <button class:cur={s.socketFit === app.params.socketFit} onclick={() => use('socketFit', s.socketFit)}>{s.socketFit >= 0 ? '+' : ''}{s.socketFit.toFixed(2)}</button>
      </div>
    {/each}
  </div>
  <p class="hint">After printing, click the winning value in each column to apply it. The highlighted values are your current settings.</p>
  <div class="foot">
    {#if phase === 'error'}<span class="err">{message}</span>{/if}
    {#if phase === 'done'}<span class="ok">Downloaded. About 25 g of filament.</span>{/if}
    <button class="primary" onclick={go} disabled={phase === 'busy'}>{phase === 'busy' ? 'Building…' : 'Download test print STL'}</button>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.35); z-index: 40; animation: fade 0.15s; }
  .dialog {
    position: fixed; z-index: 41; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px); overflow: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 16px;
    box-shadow: var(--shadow); padding: 18px 20px; font-size: 0.9rem; line-height: 1.5;
  }
  @keyframes fade { from { opacity: 0; } }
  header { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; font-size: 1.15rem; }
  .x { border: 0; background: none; color: var(--muted); font-size: 1rem; cursor: pointer; padding: 6px; }
  p { margin: 10px 0; color: var(--text); }
  ol { margin: 0 0 12px; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
  .table { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .tr { display: grid; grid-template-columns: 1.1fr 1fr 1fr 1fr; align-items: center; border-top: 1px solid var(--line); }
  .tr:first-child { border-top: 0; }
  .th { background: var(--input); font-size: 0.75rem; font-weight: 650; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .tr > * { padding: 8px 12px; }
  .dots { color: var(--accent-ink); letter-spacing: 2px; font-size: 0.8rem; }
  .tr button {
    border: 0; background: none; font: inherit; color: var(--text); text-align: left; cursor: pointer;
    font-variant-numeric: tabular-nums; border-radius: 0;
  }
  .tr button:hover { background: var(--input); }
  .tr button.cur { font-weight: 750; color: var(--accent-ink); background: var(--warn-soft); }
  .hint { font-size: 0.8rem; color: var(--muted); }
  .foot { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
  .ok { color: var(--muted); font-size: 0.84rem; }
  .err { color: var(--danger-ink); font-size: 0.84rem; }
  .primary { font: inherit; font-weight: 650; border: 0; border-radius: 11px; padding: 10px 16px; background: var(--accent); color: #1d1606; cursor: pointer; }
  .primary:disabled { opacity: 0.6; cursor: wait; }
</style>
