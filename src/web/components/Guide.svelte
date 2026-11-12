<script lang="ts">
  import { t } from '../i18n/index.svelte.ts';
  import Rich from './Rich.svelte';

  /** `token` changes every time the guide is asked for, so it scrolls into view even when it is already open. */
  let { open = $bindable(false), token = 0 }: { open?: boolean; token?: number } = $props();
  let el: HTMLDetailsElement;
  $effect(() => {
    void token;
    if (open) setTimeout(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  });
</script>

<details class="guide" bind:open bind:this={el}>
  <summary>{t('app.howToPrint')}</summary>
  <ol>
    {#each ['guide.1', 'guide.2', 'guide.3', 'guide.4', 'guide.5', 'guide.6'] as const as step (step)}
      <li><Rich text={t(step)} /></li>
    {/each}
  </ol>
</details>

<style>
  .guide { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 0 14px; scroll-margin-top: 12px; }
  summary { cursor: pointer; padding: 12px 0; font-weight: 650; min-height: var(--tap); }
  ol { margin: 0 0 14px; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 0.88rem; line-height: 1.45; color: var(--text); }
</style>
