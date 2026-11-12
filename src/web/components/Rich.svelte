<script lang="ts">
  import { pieces } from '../i18n/catalog.ts';

  /** A translated message that may carry <b> and <em>. Rendered as elements, never as HTML. */
  let { text }: { text: string } = $props();
  const parts = $derived(pieces(text));
</script>

{#each parts as p, i (i)}{#if p.tag === 'b'}<b>{p.text}</b>{:else if p.tag === 'em'}<em>{p.text}</em>{:else}{p.text}{/if}{/each}

<style>
  b { font-weight: 650; }
  em { font-style: normal; font-weight: 600; }
</style>
