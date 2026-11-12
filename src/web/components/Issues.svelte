<script lang="ts">
  import type { Issue } from '../../rules/derive.ts';
  import { FIELD_BY_KEY } from '../lib/fields.ts';
  import { app } from '../lib/state.svelte.ts';
  import { issueText, paramLabel, t } from '../i18n/index.svelte.ts';

  let { issues, failures }: { issues: Issue[]; failures: string[] } = $props();
  const order = { error: 0, warning: 1, info: 2 } as const;
  const sorted = $derived([...issues].sort((a, b) => order[a.level] - order[b.level]));
  const icon = { error: '✕', warning: '!', info: 'i' } as const;
</script>

{#if sorted.length || failures.length}
  <ul class="issues" aria-live="polite">
    {#each failures as f, i (i)}
      <li class="error"><span class="ic">✕</span><span>{t('issues.selfCheck', { detail: f })}</span></li>
    {/each}
    {#each sorted as i, k (k)}
      <li class={i.level}>
        <span class="ic">{icon[i.level]}</span>
        <span>
          {#if i.param && FIELD_BY_KEY[i.param]}
            <button type="button" onclick={() => (app.focusKey = i.param ?? null)}>{paramLabel(i.param)}</button>:
          {/if}
          {issueText(i)}
        </span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .issues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  li { display: flex; gap: 8px; align-items: flex-start; font-size: 0.82rem; line-height: 1.4; padding: 8px 10px; border-radius: 10px; }
  .error { background: var(--danger-soft); color: var(--danger-ink); }
  .warning { background: var(--warn-soft); color: var(--warn-ink); }
  .info { background: var(--info-soft); color: var(--muted); }
  .ic { flex: none; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: 0.7rem; font-weight: 800; background: currentColor; }
  .ic { color: inherit; }
  .error .ic, .warning .ic, .info .ic { background: none; border: 1.5px solid currentColor; }
  button { border: 0; background: none; padding: 0; font: inherit; font-weight: 650; color: inherit; text-decoration: underline; cursor: pointer; }
  /* a taller target for a finger, without moving the text around it */
  @media (pointer: coarse), (max-width: 699.98px) {
    button { padding: 10px 0; margin: -10px 0; }
  }
</style>
