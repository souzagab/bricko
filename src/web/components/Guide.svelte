<script lang="ts">
  // static content
</script>

<details class="guide">
  <summary>How to print</summary>
  <ol>
    <li><strong>Print it exactly as downloaded</strong>: lying on its side, hinge pointing up. No supports. A brim is optional.</li>
    <li><strong>PETG or PLA+</strong> work best. Plain PLA works, but the latch gets tired sooner.</li>
    <li>If your slicer's <em>elephant foot compensation</em> is on, set <em>First-layer inset</em> (Printing) to 0. Use one or the other, not both.</li>
    <li>After printing, open the clip gently once to free the hinge.</li>
    <li><strong>Hinge fused?</strong> Raise <em>Clearance</em> by 0.05 mm and reprint. <strong>Wobbly?</strong> Lower it by 0.05 mm.</li>
    <li><strong>Bricks too loose or too tight?</strong> Adjust <em>Stud fit</em> (top) or <em>Socket fit</em> (bottom) in 0.03 mm steps.</li>
  </ol>
</details>

<style>
  .guide { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 0 14px; }
  summary { cursor: pointer; padding: 12px 0; font-weight: 650; }
  ol { margin: 0 0 14px; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 0.86rem; line-height: 1.45; color: var(--text); }
  em { font-style: normal; font-weight: 600; }
</style>
