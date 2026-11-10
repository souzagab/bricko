<script lang="ts">
  import { app } from '../lib/state.svelte.ts';
  import { CABLE_KINDS, KIND_BY_ID, MAX_CABLES, MAX_D, MIN_D, ROOM, fitOf, type Fit } from '../lib/cables.ts';

  const fit = $derived(fitOf(app.room));
  const W = $derived(app.params.studsAcross * app.params.studPitch - app.params.brickPlay);

  const HINGE = [
    { id: 'tight', label: 'Tighter', value: 0.2 },
    { id: 'standard', label: 'Standard', value: 0.25 },
    { id: 'loose', label: 'Looser', value: 0.32 },
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
    <h2><span class="n">1</span>Your cables</h2>
    <ul class="cables">
      {#each app.cables as c, i (i)}
        <li>
          <select aria-label="Cable {i + 1}" value={c.kind} onchange={(e) => setKind(i, e.currentTarget.value)}>
            {#each CABLE_KINDS as k (k.id)}<option value={k.id}>{k.label} · {k.d} mm</option>{/each}
            <option value="custom">Other size…</option>
          </select>
          {#if c.kind === 'custom'}
            <label class="mm">
              <input type="number" min={MIN_D} max={MAX_D} step="0.5" value={c.d} aria-label="Cable {i + 1} thickness"
                onchange={(e) => setD(i, e.currentTarget.valueAsNumber)} />
              mm
            </label>
          {/if}
          <button class="icon" onclick={() => remove(i)} disabled={app.cables.length <= 1} aria-label="Remove cable {i + 1}" title="Remove">✕</button>
        </li>
      {/each}
    </ul>
    <button class="add" onclick={add} disabled={app.cables.length >= MAX_CABLES}>+ Add a cable</button>
    <p class="hint">Not sure of a size? Measure the cable's thickness and pick <em>Other size</em>.</p>
    <span class="q">How should cables sit?</span>
    <div class="seg" role="radiogroup" aria-label="How cables sit">
      <button role="radio" aria-checked={fit === 'easy'} class:on={fit === 'easy'} onclick={() => setFit('easy')}>
        <b>Easy</b><span>cables drop in</span>
      </button>
      <button role="radio" aria-checked={fit === 'snug'} class:on={fit === 'snug'} onclick={() => setFit('snug')}>
        <b>Snug</b><span>cables click in</span>
      </button>
    </div>
  </li>

  <li class="step" class:bad={errorOn(['studsAcross'])}>
    <h2><span class="n">2</span>Width</h2>
    <div class="seg" role="radiogroup" aria-label="Clip width in studs">
      {#each [1, 2, 3, 4] as n (n)}
        <button role="radio" aria-checked={app.params.studsAcross === n} class:on={app.params.studsAcross === n} onclick={() => (app.params.studsAcross = n)}>
          <b>{n}</b><span>{n === 1 ? 'stud' : 'studs'}</span>
        </button>
      {/each}
    </div>
    <p class="hint">{W.toFixed(1)} mm wide. Wider clips are stronger.</p>
  </li>

  <li class="step">
    <h2><span class="n">3</span>Bricks</h2>
    <label class="toggle">
      <input type="checkbox" checked={app.params.studsOn} onchange={(e) => (app.params.studsOn = e.currentTarget.checked)} />
      <span class="track" aria-hidden="true"></span>
      <span><b>Studs on top</b><small>Build on top of the clip</small></span>
    </label>
    <label class="toggle">
      <input type="checkbox" checked={app.params.bottomMode === 'pockets'} onchange={(e) => (app.params.bottomMode = e.currentTarget.checked ? 'pockets' : 'flat')} />
      <span class="track" aria-hidden="true"></span>
      <span><b>Snaps onto bricks</b><small>Press it onto a brick or baseplate</small></span>
    </label>
  </li>

  <li class="step">
    <h2><span class="n">4</span>Hinge fit</h2>
    <div class="seg" role="radiogroup" aria-label="Hinge fit">
      {#each HINGE as h (h.id)}
        <button role="radio" aria-checked={hinge === h.id} class:on={hinge === h.id} onclick={() => (app.params.clearance = h.value)}>
          <b>{h.label}</b>
        </button>
      {/each}
    </div>
    <p class="hint">
      {#if hinge === null}Custom gap: {app.params.clearance} mm (set in Advanced).{:else}Hinge stuck after printing? Choose <em>Looser</em>. Wobbly? <em>Tighter</em>.{/if}
      <button class="link" onclick={() => (app.testPrint = true)}>Print a fit test first →</button>
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
    font: inherit; font-size: 0.92rem; color: var(--text); background: var(--input);
    border: 1px solid var(--line); border-radius: 10px; padding: 9px 10px; min-width: 0;
  }
  select { flex: 1; }
  .mm { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; color: var(--muted); }
  .mm input { width: 4.6em; text-align: right; padding: 9px 6px; }
  .icon { border: 1px solid transparent; background: none; color: var(--muted); width: 34px; height: 38px; border-radius: 9px; cursor: pointer; flex: none; }
  .icon:hover:not(:disabled) { background: var(--input); color: var(--danger-ink); }
  .icon:disabled { opacity: 0.3; cursor: default; }
  .add {
    align-self: flex-start; font: inherit; font-weight: 600; font-size: 0.9rem; color: var(--accent-ink);
    background: none; border: 1.5px dashed var(--line-strong); border-radius: 10px; padding: 8px 14px; cursor: pointer;
  }
  .add:hover:not(:disabled) { border-color: var(--accent); background: var(--warn-soft); }
  .add:disabled { opacity: 0.5; cursor: default; }
  .q { font-size: 0.85rem; font-weight: 600; margin-bottom: -4px; }
  .hint { margin: 0; font-size: 0.8rem; color: var(--muted); line-height: 1.45; }
  .hint em { font-style: normal; font-weight: 600; color: var(--text); }
  .link { border: 0; background: none; padding: 0; font: inherit; color: var(--accent-ink); font-weight: 600; cursor: pointer; display: inline; }
  .link:hover { text-decoration: underline; }
  .seg { display: flex; gap: 4px; background: var(--input); border: 1px solid var(--line); border-radius: 11px; padding: 3px; }
  .seg button {
    flex: 1; border: 0; background: none; font: inherit; color: var(--muted); padding: 7px 4px; border-radius: 8px; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 1px; line-height: 1.2;
  }
  .seg button b { font-size: 0.92rem; color: inherit; font-weight: 600; }
  .seg button span { font-size: 0.72rem; }
  .seg button.on { background: var(--panel); color: var(--text); box-shadow: var(--shadow-sm); }
  .seg button.on b { color: var(--text); }
  .toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 2px 0; }
  .toggle input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .toggle span:last-child { display: flex; flex-direction: column; font-size: 0.92rem; }
  .toggle small { color: var(--muted); font-size: 0.78rem; }
  .track { width: 38px; height: 22px; border-radius: 99px; background: var(--line-strong); position: relative; flex: none; transition: background 0.2s; }
  .track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px #0003; transition: transform 0.2s; }
  .toggle input:checked + .track { background: var(--accent); }
  .toggle input:checked + .track::after { transform: translateX(16px); }
  .toggle input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
