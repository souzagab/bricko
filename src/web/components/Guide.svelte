<script lang="ts">
  let { open = $bindable(false) }: { open?: boolean } = $props();
  let el: HTMLDetailsElement;
  $effect(() => {
    if (open) setTimeout(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  });
</script>

<details class="guide" bind:open bind:this={el}>
  <summary>How to print</summary>
  <ol>
    <li><strong>Don't rotate it.</strong> The file is already lying on its side, hinge pointing up. That's how it prints best.</li>
    <li><strong>No supports, no assembly.</strong> The hinge prints already joined. A brim is fine if your bed is slippery.</li>
    <li><strong>PETG or PLA+</strong> work best. Plain PLA works too.</li>
    <li>When it's done, open the lid gently once to free the hinge.</li>
    <li><strong>Hinge stuck?</strong> Choose <em>Looser</em> under Hinge fit and print again. <strong>Wobbly?</strong> Choose <em>Tighter</em>.</li>
    <li><strong>First clip?</strong> Print the fit test (Hinge fit → <em>Print a fit test</em>). It tells you the best settings for your printer.</li>
  </ol>
</details>

<style>
  .guide { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 0 14px; scroll-margin-top: 12px; }
  summary { cursor: pointer; padding: 12px 0; font-weight: 650; }
  ol { margin: 0 0 14px; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 0.88rem; line-height: 1.45; color: var(--text); }
  em { font-style: normal; font-weight: 600; }
</style>
