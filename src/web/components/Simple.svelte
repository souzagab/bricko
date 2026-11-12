<script lang="ts">
  import { app } from '../lib/state.svelte.ts';
  import { CABLE_KINDS, KIND_BY_ID, MAX_CABLES, MAX_D, MIN_D, ROOM, fitOf, type Fit } from '../lib/cables.ts';
  import { cableName, num, t } from '../i18n/index.svelte.ts';
  import Rich from './Rich.svelte';

  const fit = $derived(fitOf(app.room));
  const W = $derived(app.params.studsAcross * app.params.studPitch - app.params.brickPlay);

  const HINGE = [
    { id: 'tight', label: 'hinge.tighter', value: 0.2 },
    { id: 'standard', label: 'hinge.standard', value: 0.25 },
    { id: 'loose', label: 'hinge.looser', value: 0.32 },
  ] as const;
  const hinge = $derived(HINGE.find((h) => Math.abs(h.value - app.params.clearance) < 1e-6)?.id ?? null);

  const errorOn = (keys: string[]) => (app.result?.issues ?? []).some((i) => i.level === 'error' && i.param && keys.includes(i.param));

  function setKind(i: number, id: string) {
    const c = app.cables[i];
    if (!c) return;
    if (id === 'custom') app.cables[i] = { kind: 'custom', d: c.d };
    else app.cables[i] = { kind: id, d: KIND_BY_ID[id]!.d };
  }
  function setD(i: number, v: number) {
    if (!Number.isFinite(v)) return;
    app.cables[i] = { kind: 'custom', d: Math.min(MAX_D, Math.max(MIN_D, Math.round(v * 10) / 10)) };
  }
  function add() {
    if (app.cables.length >= MAX_CABLES) return;
    const last = app.cables[app.cables.length - 1];
    app.cables.push(last ? { ...last } : { kind: 'phone', d: 4 });
  }
  function remove(i: number) {
    if (app.cables.length > 1) app.cables.splice(i, 1);
  }
  const setFit = (f: Fit) => (app.room = ROOM[f]);
</script>

<ol class="steps">
  <li class="step">
    <h2><span class="n">1</span>{t('cables.title')}</h2>
    <ul class="cables">
      {#each app.cables as c, i (i)}
        <li>
          <select aria-label={t('cables.cable', { n: i + 1 })} value={c.kind} onchange={(e) => setKind(i, e.currentTarget.value)}>
            {#each CABLE_KINDS as k (k.id)}<option value={k.id}>{cableName(k.id)} · {num(k.d)} mm</option>{/each}
            <option value="custom">{t('cables.other')}</option>
          </select>
          {#if c.kind === 'custom'}
            <label class="mm">
              <input type="number" inputmode="decimal" enterkeyhint="done" min={MIN_D} max={MAX_D} step="0.5" value={c.d} aria-label={t('cables.thickness', { n: i + 1 })}
                onchange={(e) => setD(i, e.currentTarget.valueAsNumber)} />
              mm
            </label>
          {/if}
          <button class="icon" onclick={() => remove(i)} disabled={app.cables.length <= 1} aria-label={t('cables.remove', { n: i + 1 })} title={t('cables.removeTip')}>✕</button>
        </li>
      {/each}
    </ul>
    <button class="add" onclick={add} disabled={app.cables.length >= MAX_CABLES}>{t('cables.add')}</button>
    <p class="hint"><Rich text={t('cables.hint')} /></p>
    <span class="q">{t('fit.question')}</span>
    <div class="seg" role="radiogroup" aria-label={t('fit.label')}>
      <button role="radio" aria-checked={fit === 'easy'} class:on={fit === 'easy'} onclick={() => setFit('easy')}>
        <b>{t('fit.easy')}</b><span>{t('fit.easySub')}</span>
      </button>
      <button role="radio" aria-checked={fit === 'snug'} class:on={fit === 'snug'} onclick={() => setFit('snug')}>
        <b>{t('fit.snug')}</b><span>{t('fit.snugSub')}</span>
      </button>
    </div>
  </li>

  <li class="step" class:bad={errorOn(['studsAcross'])}>
    <h2><span class="n">2</span>{t('width.title')}</h2>
    <div class="seg" role="radiogroup" aria-label={t('width.label')}>
      {#each [1, 2, 3, 4] as n (n)}
        <button role="radio" aria-checked={app.params.studsAcross === n} class:on={app.params.studsAcross === n} onclick={() => (app.params.studsAcross = n)}>
          <b>{n}</b><span>{t('width.studs', { n })}</span>
        </button>
      {/each}
    </div>
    <p class="hint">{t('width.hint', { mm: num(W, 1, 1) })}</p>
  </li>

  <li class="step">
    <h2><span class="n">3</span>{t('bricks.title')}</h2>
    <label class="toggle">
      <input type="checkbox" checked={app.params.studsOn} onchange={(e) => (app.params.studsOn = e.currentTarget.checked)} />
      <span class="track" aria-hidden="true"></span>
      <span><b>{t('bricks.studs')}</b><small>{t('bricks.studsSub')}</small></span>
    </label>
    <label class="toggle">
      <input type="checkbox" checked={app.params.bottomMode === 'pockets'} onchange={(e) => (app.params.bottomMode = e.currentTarget.checked ? 'pockets' : 'flat')} />
      <span class="track" aria-hidden="true"></span>
      <span><b>{t('bricks.sockets')}</b><small>{t('bricks.socketsSub')}</small></span>
    </label>
  </li>

  <li class="step">
    <h2><span class="n">4</span>{t('hinge.title')}</h2>
    <div class="seg" role="radiogroup" aria-label={t('hinge.title')}>
      {#each HINGE as h (h.id)}
        <button role="radio" aria-checked={hinge === h.id} class:on={hinge === h.id} onclick={() => (app.params.clearance = h.value)}>
          <b>{t(h.label)}</b>
        </button>
      {/each}
    </div>
    <p class="hint">
      {#if hinge === null}{t('hinge.custom', { mm: num(app.params.clearance) })}{:else}<Rich text={t('hinge.hint')} />{/if}
      <button class="link" onclick={() => (app.testPrint = true)}>{t('hinge.fitTest')}</button>
    </p>
  </li>
</ol>

<style>
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .step { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .step.bad { border-color: var(--danger-ink); box-shadow: 0 0 0 3px var(--danger-soft); }
  h2 { margin: 0; font-size: 1rem; display: flex; align-items: center; gap: 9px; }
  .n { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 0.78rem; background: var(--accent); color: #1d1606; flex: none; }
  .cables { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .cables li { display: flex; gap: 6px; align-items: center; }
  select, .mm input {
    font: inherit; font-size: var(--field-font, 0.92rem); color: var(--text); background: var(--input);
    border: 1px solid var(--line); border-radius: 10px; padding: 9px 10px; min-width: 0; min-height: var(--tap);
  }
  select { flex: 1; }
  .mm { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; color: var(--muted); }
  .mm input { width: 4.6em; text-align: right; padding: 9px 6px; }
  .icon { border: 1px solid transparent; background: none; color: var(--muted); width: 34px; height: 38px; min-width: var(--tap); min-height: var(--tap); border-radius: 9px; cursor: pointer; flex: none; }
  .icon:disabled { opacity: 0.3; cursor: default; }
  .add {
    align-self: flex-start; font: inherit; font-weight: 600; font-size: 0.9rem; color: var(--accent-ink);
    background: none; border: 1.5px dashed var(--line-strong); border-radius: 10px; padding: 8px 14px; cursor: pointer; min-height: var(--tap);
  }
  .add:disabled { opacity: 0.5; cursor: default; }
  .q { font-size: 0.85rem; font-weight: 600; margin-bottom: -4px; }
  .hint { margin: 0; font-size: 0.8rem; color: var(--muted); line-height: 1.45; }
  .hint :global(em) { color: var(--text); }
  .link { border: 0; background: none; padding: 0; font: inherit; color: var(--accent-ink); font-weight: 600; cursor: pointer; display: inline; }
  /* hover styles only where there is a pointer to hover with: on a touch screen they stick to the last thing tapped */
  @media (hover: hover) {
    .icon:hover:not(:disabled) { background: var(--input); color: var(--danger-ink); }
    .add:hover:not(:disabled) { border-color: var(--accent); background: var(--warn-soft); }
    .link:hover { text-decoration: underline; }
  }
  /* a link in running text is too small a target for a finger: give it its own line */
  @media (pointer: coarse), (max-width: 699.98px) {
    .link { display: block; min-height: var(--tap); padding: 6px 0 0; text-align: left; }
  }
  .seg { display: flex; gap: 4px; background: var(--input); border: 1px solid var(--line); border-radius: 11px; padding: 3px; }
  .seg button {
    flex: 1; border: 0; background: none; font: inherit; color: var(--muted); padding: 7px 4px; border-radius: 8px; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; line-height: 1.2; min-height: var(--tap);
  }
  .seg button b { font-size: 0.92rem; color: inherit; font-weight: 600; }
  .seg button span { font-size: 0.72rem; }
  .seg button.on { background: var(--panel); color: var(--text); box-shadow: var(--shadow-sm); }
  .seg button.on b { color: var(--text); }
  /* position: relative keeps the hidden checkbox inside the scrolling panel. Without it the checkbox is placed
     against the page, sticks out below the window, and focusing it (a tap on the label) scrolls the whole app. */
  .toggle { position: relative; display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 2px 0; min-height: var(--tap); }
  .toggle input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .toggle span:last-child { display: flex; flex-direction: column; font-size: 0.92rem; }
  .toggle small { color: var(--muted); font-size: 0.78rem; }
  .track { width: 38px; height: 22px; border-radius: 99px; background: var(--line-strong); position: relative; flex: none; transition: background 0.2s; }
  .track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px #0003; transition: transform 0.2s; }
  .toggle input:checked + .track { background: var(--accent); }
  .toggle input:checked + .track::after { transform: translateX(16px); }
  .toggle input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
