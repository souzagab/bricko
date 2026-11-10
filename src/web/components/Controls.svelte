<script lang="ts">
  import { PRESETS } from '../../params/presets.ts';
  import { parseParams } from '../../params/schema.ts';
  import { FIELDS, GROUPS, type Field, type ParamKey } from '../lib/fields.ts';
  import { app } from '../lib/state.svelte.ts';
  import FieldView from './Field.svelte';

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

  const visible = (f: Field) => f.kind !== 'array' && (app.advanced || !f.advanced || flags.has(f.key));
  const hiddenCount = $derived(FIELDS.filter((f) => f.advanced && f.kind !== 'array').length);
  let open = $state<Record<string, boolean>>({ channels: true, body: true });

  // Reveal the group of a field that an issue points to
  $effect(() => {
    const k = app.focusKey;
    if (!k) return;
    const f = FIELDS.find((x) => x.key === k);
    if (!f) return;
    if (f.advanced) app.advanced = true;
    open[f.group] = true;
    queueMicrotask(() => document.getElementById(`field-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    app.focusKey = null;
  });

  function set(key: ParamKey, v: unknown) {
    (app.params as Record<string, unknown>)[key] = v;
    app.preset = 'custom';
  }

  function applyPreset(name: string) {
    app.preset = name;
    const p = PRESETS[name];
    if (p) app.params = parseParams(p.params);
  }

  // Per-channel widths
  const perChannel = $derived(Array.isArray(app.params.channelWidths));
  function togglePerChannel(on: boolean) {
    app.params.channelWidths = on ? Array.from({ length: app.params.channelCount }, () => app.params.channelWidth) : undefined;
    app.preset = 'custom';
  }
  $effect(() => {
    const n = app.params.channelCount;
    const ws = app.params.channelWidths;
    if (!ws || ws.length === n) return;
    app.params.channelWidths = Array.from({ length: n }, (_, i) => ws[i] ?? ws[ws.length - 1] ?? app.params.channelWidth);
  });
  function setWidth(i: number, v: number) {
    if (!Number.isFinite(v) || !app.params.channelWidths) return;
    const ws = [...app.params.channelWidths];
    ws[i] = Math.min(60, Math.max(3, v));
    app.params.channelWidths = ws;
    app.preset = 'custom';
  }
</script>

<div class="controls">
  <div class="top">
    <label class="preset">
      <span>Start from</span>
      <select value={app.preset} onchange={(e) => applyPreset(e.currentTarget.value)}>
        {#if app.preset === 'custom'}<option value="custom">Custom</option>{/if}
        {#each Object.entries(PRESETS) as [k, p] (k)}<option value={k}>{p.label}</option>{/each}
      </select>
    </label>
    <div class="top-row">
      <label class="adv">
        <input type="checkbox" bind:checked={app.advanced} />
        Show advanced <span class="count">+{hiddenCount}</span>
      </label>
      <button type="button" class="link" onclick={() => applyPreset('default')}>Reset</button>
    </div>
  </div>

  {#each GROUPS as g (g.id)}
    {@const fields = FIELDS.filter((f) => f.group === g.id && visible(f))}
    {#if fields.length}
      <details class="group" bind:open={open[g.id]}>
        <summary>
          <span class="gtitle">{g.title}</span>
          <span class="gblurb">{g.blurb}</span>
        </summary>
        <div class="fields">
          {#each fields as f (f.key)}
            <FieldView field={f} value={app.params[f.key]} flagged={flags.get(f.key) ?? null} onchange={(v) => set(f.key, v)} />
          {/each}
          {#if g.id === 'channels'}
            <div class="per">
              <label class="adv">
                <input type="checkbox" checked={perChannel} onchange={(e) => togglePerChannel(e.currentTarget.checked)} />
                Different width per channel
              </label>
              {#if app.params.channelWidths}
                <div class="widths">
                  {#each app.params.channelWidths as w, i (i)}
                    <label>
                      <span>#{i + 1}</span>
                      <input type="number" min="3" max="60" step="0.5" value={w} onchange={(e) => setWidth(i, e.currentTarget.valueAsNumber)} />
                    </label>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </details>
    {/if}
  {/each}
</div>

<style>
  .controls { display: flex; flex-direction: column; gap: 10px; }
  .top { display: flex; flex-direction: column; gap: 10px; padding: 4px 4px 6px; }
  .preset { display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .preset select {
    font: inherit; font-size: 0.95rem; text-transform: none; letter-spacing: 0; color: var(--text); font-weight: 500;
    padding: 9px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--input);
  }
  .top-row { display: flex; justify-content: space-between; align-items: center; }
  .adv { display: flex; align-items: center; gap: 8px; font-size: 0.86rem; color: var(--text); cursor: pointer; }
  .adv input { accent-color: var(--accent); width: 16px; height: 16px; }
  .count { font-size: 0.75rem; color: var(--muted); }
  .link { border: 0; background: none; color: var(--accent-ink); font: inherit; font-size: 0.86rem; cursor: pointer; padding: 4px; }
  .link:hover { text-decoration: underline; }
  .group { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  summary {
    list-style: none; cursor: pointer; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px;
    position: relative;
  }
  summary::-webkit-details-marker { display: none; }
  summary::after {
    content: ''; position: absolute; right: 16px; top: 18px; width: 7px; height: 7px;
    border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(45deg); transition: transform 0.2s;
  }
  details[open] > summary::after { transform: rotate(225deg); top: 21px; }
  .gtitle { font-weight: 650; font-size: 0.98rem; }
  .gblurb { font-size: 0.8rem; color: var(--muted); padding-right: 24px; }
  .fields { display: flex; flex-direction: column; padding: 0 4px 8px; }
  .per { padding: 8px 12px; display: flex; flex-direction: column; gap: 10px; }
  .widths { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
  .widths label { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--muted); }
  .widths input {
    width: 100%; padding: 5px 6px; font: inherit; font-size: 0.88rem; border: 1px solid var(--line);
    border-radius: 7px; background: var(--input); color: var(--text);
  }
</style>
