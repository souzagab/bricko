<script lang="ts">
  import { FIELDS, GROUPS, SIMPLE_KEYS, type ParamKey } from '../lib/fields.ts';
  import { app } from '../lib/state.svelte.ts';
  import FieldView from './Field.svelte';
  import Issues from './Issues.svelte';

  const flags = $derived.by(() => {
    const m = new Map<string, 'error' | 'warning' | 'info'>();
    const rank = { info: 0, warning: 1, error: 2 } as const;
    for (const i of app.result?.issues ?? []) {
      if (!i.param) continue;
      const prev = m.get(i.param);
      if (!prev || rank[i.level] > rank[prev]) m.set(i.param, i.level);
    }
    return m;
  });
  const fields = FIELDS.filter((f) => !SIMPLE_KEYS.has(f.key) && f.kind !== 'array');
  let open = $state<Record<string, boolean>>({});

  // An issue was clicked: open the panel, the group, and scroll to the field
  $effect(() => {
    const k = app.focusKey;
    if (!k) return;
    const f = fields.find((x) => x.key === k);
    app.focusKey = null;
    if (!f) return;
    app.showAdvanced = true;
    open[f.group] = true;
    setTimeout(() => document.getElementById(`field-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  });

  const set = (key: ParamKey, v: unknown) => ((app.params as Record<string, unknown>)[key] = v);
  const report = $derived(app.result?.report ?? null);
</script>

<details class="adv" bind:open={app.showAdvanced}>
  <summary>
    <span>Advanced settings</span>
    <small>Exact sizes, hinge, latch, brick fit, printer</small>
  </summary>

  <div class="body">
    {#if (app.result?.issues ?? []).some((i) => i.level !== 'error')}
      <Issues issues={(app.result?.issues ?? []).filter((i) => i.level !== 'error')} failures={[]} />
    {/if}
    <section class="card">
      <h3>Cables</h3>
      <div class="field">
        <div class="row">
          <label for="room">Extra room around each cable</label>
          <span class="num"><input id="room" type="number" min="0" max="6" step="0.1" value={app.room}
            onchange={(e) => { const v = e.currentTarget.valueAsNumber; if (Number.isFinite(v)) app.room = Math.min(6, Math.max(0, v)); }} /> mm</span>
        </div>
        <input type="range" min="0" max="6" step="0.1" value={app.room} aria-label="Extra room around each cable"
          oninput={(e) => (app.room = e.currentTarget.valueAsNumber)} />
        <p class="help">
          Channels are {app.params.channelWidths?.map((w) => w.toFixed(1)).join(' / ')} mm wide and {app.params.channelHeight.toFixed(1)} mm tall.
        </p>
      </div>
    </section>

    {#each GROUPS as g (g.id)}
      {@const gf = fields.filter((f) => f.group === g.id)}
      {#if gf.length}
        <details class="card group" bind:open={open[g.id]}>
          <summary><h3>{g.title}</h3><small>{g.blurb}</small></summary>
          {#each gf as f (f.key)}
            <FieldView field={f} value={app.params[f.key]} flagged={flags.get(f.key) ?? null} onchange={(v) => set(f.key, v)} />
          {/each}
        </details>
      {/if}
    {/each}

    <section class="card">
      <h3>Preview</h3>
      <div class="field">
        <div class="row"><label for="open">Open the lid</label><span class="val">{Math.round(app.openAngle)}°</span></div>
        <input id="open" type="range" min="0" max="170" step="1" bind:value={app.openAngle} />
      </div>
      <div class="field">
        <div class="row"><label for="cut">Cut-away view</label><span class="val">{app.section >= 0.999 ? 'off' : `${Math.round(app.section * 100)}%`}</span></div>
        <input id="cut" type="range" min="0.02" max="1" step="0.01" bind:value={app.section} />
        <p class="help">Slice through the clip to see the hinge and latch inside.</p>
      </div>
    </section>

    {#if report}
      <section class="card diag">
        <h3>Checks</h3>
        <dl>
          <dt>Two separate parts</dt><dd>{report.baseParts === 1 && report.armParts === 1 ? '✓' : '✕'}</dd>
          <dt>Parts never touch</dt><dd>{report.overlapVolume < 1e-4 ? '✓' : '✕'}</dd>
          <dt>Smallest gap</dt><dd>{report.minGap.toFixed(3)} mm</dd>
          <dt>Plastic volume</dt><dd>{report.volumeCm3.toFixed(2)} cm³</dd>
          <dt>Build time</dt><dd>{app.result?.ms.toFixed(0)} ms</dd>
        </dl>
      </section>
    {/if}

    <button class="reset" onclick={() => app.reset()}>Reset everything to defaults</button>
  </div>
</details>

<style>
  .adv { border: 1px solid var(--line); border-radius: 14px; background: var(--bg); }
  .adv > summary {
    list-style: none; cursor: pointer; padding: 13px 14px; display: flex; flex-direction: column; gap: 2px; position: relative;
  }
  .adv > summary span { font-weight: 650; }
  .adv > summary small { color: var(--muted); font-size: 0.8rem; }
  summary::-webkit-details-marker { display: none; }
  .adv > summary::after, .group > summary::after {
    content: ''; position: absolute; right: 16px; top: 19px; width: 7px; height: 7px;
    border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(45deg); transition: transform 0.2s;
  }
  details[open] > summary::after { transform: rotate(225deg); top: 22px; }
  .body { display: flex; flex-direction: column; gap: 8px; padding: 0 8px 10px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 4px 4px 6px; }
  section.card { padding: 10px 4px 6px; }
  .card h3 { margin: 0 12px 2px; font-size: 0.92rem; }
  .group > summary { list-style: none; cursor: pointer; position: relative; padding: 9px 0 7px; display: flex; flex-direction: column; gap: 2px; }
  .group > summary small { margin: 0 40px 0 12px; font-size: 0.78rem; color: var(--muted); }
  .group > summary::after { top: 14px; }
  .group[open] > summary::after { top: 17px; }
  .field { padding: 8px 12px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 550; }
  .num { display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; color: var(--muted); font-weight: 400; }
  .num input { width: 4.6em; padding: 4px 6px; text-align: right; font: inherit; font-size: 0.88rem; border: 1px solid var(--line); border-radius: 7px; background: var(--input); color: var(--text); }
  .val { font-size: 0.82rem; color: var(--muted); font-variant-numeric: tabular-nums; font-weight: 400; }
  input[type='range'] { width: 100%; margin: 8px 0 2px; accent-color: var(--accent); }
  .help { margin: 4px 0 0; font-size: 0.78rem; color: var(--muted); line-height: 1.4; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 8px 12px 4px; font-size: 0.82rem; }
  dt { color: var(--muted); }
  dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .reset { align-self: center; border: 0; background: none; color: var(--danger-ink); font: inherit; font-size: 0.85rem; padding: 8px; cursor: pointer; }
  .reset:hover { text-decoration: underline; }
</style>
