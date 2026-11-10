<script lang="ts">
  import { decimals, type Field } from '../lib/fields.ts';

  interface Props {
    field: Field;
    value: unknown;
    onchange: (v: unknown) => void;
    flagged?: 'error' | 'warning' | 'info' | null;
  }
  let { field, value, onchange, flagged = null }: Props = $props();

  const id = $derived(`field-${field.key}`);
  const dp = $derived(decimals(field.step));
  const clamp = (v: number) => Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, v));
  const snap = (v: number) => (field.kind === 'integer' ? Math.round(v) : Number(v.toFixed(dp)));

  function onNumber(e: Event, commit: boolean) {
    const raw = (e.currentTarget as HTMLInputElement).valueAsNumber;
    if (!Number.isFinite(raw)) return;
    const v = snap(commit ? clamp(raw) : raw);
    if (!commit && (v < (field.min ?? -Infinity) || v > (field.max ?? Infinity))) return;
    onchange(v);
  }
</script>

<div class="field" class:flag-error={flagged === 'error'} class:flag-warning={flagged === 'warning'} class:flag-info={flagged === 'info'} {id}>
  {#if field.kind === 'boolean'}
    <label class="switch">
      <input type="checkbox" checked={value as boolean} onchange={(e) => onchange(e.currentTarget.checked)} />
      <span class="track" aria-hidden="true"></span>
      <span class="label">{field.label}</span>
    </label>
  {:else if field.kind === 'enum'}
    <span class="label">{field.label}</span>
    <div class="seg" role="radiogroup" aria-label={field.label}>
      {#each field.options ?? [] as o (o.value)}
        <button type="button" role="radio" aria-checked={value === o.value} class:on={value === o.value} onclick={() => onchange(o.value)}>{o.label}</button>
      {/each}
    </div>
  {:else}
    <div class="row">
      <label class="label" for="{id}-num">{field.label}</label>
      <span class="num">
        <input
          id="{id}-num" type="number" inputmode="decimal"
          min={field.min} max={field.max} step={field.step}
          value={typeof value === 'number' ? Number(value.toFixed(dp)) : ''}
          oninput={(e) => onNumber(e, false)} onchange={(e) => onNumber(e, true)}
        />
        {#if field.unit}<span class="unit">{field.unit}</span>{/if}
      </span>
    </div>
    <input
      class="range" type="range" aria-label={field.label}
      min={field.min} max={field.max} step={field.step} value={value as number}
      oninput={(e) => onchange(snap(e.currentTarget.valueAsNumber))}
    />
  {/if}
  {#if field.help}<p class="help">{field.help}</p>{/if}
</div>

<style>
  .field { padding: 10px 12px; border-radius: 10px; transition: background 0.3s; }
  .field.flag-error { background: var(--danger-soft); }
  .field.flag-warning { background: var(--warn-soft); }
  .field.flag-info { background: var(--info-soft); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .label { font-size: 0.9rem; font-weight: 550; color: var(--text); }
  .num { display: inline-flex; align-items: center; gap: 4px; }
  .num input {
    width: 5.2em; padding: 4px 6px; text-align: right; font: inherit; font-size: 0.88rem;
    border: 1px solid var(--line); border-radius: 7px; background: var(--input); color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .num input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .unit { font-size: 0.78rem; color: var(--muted); width: 1.8em; }
  .range { width: 100%; margin: 8px 0 2px; accent-color: var(--accent); }
  .help { margin: 4px 0 0; font-size: 0.78rem; line-height: 1.4; color: var(--muted); }
  .seg { display: flex; margin-top: 8px; background: var(--input); border: 1px solid var(--line); border-radius: 9px; padding: 3px; gap: 3px; }
  .seg button {
    flex: 1; border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 0.85rem;
    padding: 6px 8px; border-radius: 6px; cursor: pointer;
  }
  .seg button.on { background: var(--panel); color: var(--text); font-weight: 600; box-shadow: var(--shadow-sm); }
  .switch { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .track { width: 36px; height: 21px; border-radius: 99px; background: var(--line-strong); position: relative; flex: none; transition: background 0.2s; }
  .track::after { content: ''; position: absolute; top: 2.5px; left: 2.5px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px #0003; transition: transform 0.2s; }
  .switch input:checked + .track { background: var(--accent); }
  .switch input:checked + .track::after { transform: translateX(15px); }
  .switch input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
