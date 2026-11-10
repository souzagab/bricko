#!/usr/bin/env node
/**
 * Usage:
 *   node cli/gen.ts [--preset name] [--params file.json] [--set key=value ...] [-o out.stl]
 *   node cli/gen.ts --all-presets -o out/
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { generate, stlOf } from '../src/generate.ts';
import { PRESETS } from '../src/params/presets.ts';

const { values } = parseArgs({
  options: {
    preset: { type: 'string' },
    params: { type: 'string' },
    set: { type: 'string', multiple: true },
    out: { type: 'string', short: 'o' },
    'all-presets': { type: 'boolean' },
    json: { type: 'boolean' },
  },
});

function coerce(v: string): unknown {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.includes(',')) return v.split(',').map(Number);
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

async function run(name: string, input: Record<string, unknown>, out: string) {
  const r = await generate(input);
  for (const i of r.issues) console.log(`  ${i.level.padEnd(7)} ${i.param ?? ''} ${i.message}`);
  if (!r.report) {
    console.log(`✗ ${name}: not generated`);
    return false;
  }
  const rep = r.report;
  const size = rep.size.map((v) => v.toFixed(1)).join(' × ');
  console.log(`${rep.ok ? '✓' : '✗'} ${name}: ${size} mm, ${rep.volumeCm3.toFixed(2)} cm³, gap ${rep.minGap.toFixed(3)} mm, ${r.ms.toFixed(0)} ms`);
  for (const f of rep.failures) console.log(`  FAIL ${f}`);
  if (values.json) console.log(JSON.stringify({ derived: { ...r.derived, issues: undefined }, report: rep }, null, 2));
  await writeFile(out, stlOf(r));
  console.log(`  → ${out}`);
  return rep.ok;
}

if (values['all-presets']) {
  const dir = values.out ?? 'out';
  await mkdir(dir, { recursive: true });
  let ok = true;
  for (const [name, preset] of Object.entries(PRESETS)) {
    ok = (await run(name, preset.params as Record<string, unknown>, join(dir, `bricko-${name}.stl`))) && ok;
  }
  process.exit(ok ? 0 : 1);
} else {
  let input: Record<string, unknown> = {};
  if (values.preset) {
    const pr = PRESETS[values.preset];
    if (!pr) throw new Error(`unknown preset ${values.preset}; have: ${Object.keys(PRESETS).join(', ')}`);
    input = { ...(pr.params as Record<string, unknown>) };
  }
  if (values.params) input = { ...input, ...JSON.parse(await readFile(values.params, 'utf8')) };
  for (const kv of values.set ?? []) {
    const [k, v] = kv.split('=');
    if (!k || v === undefined) throw new Error(`bad --set ${kv}`);
    input[k] = coerce(v);
  }
  const ok = await run(values.preset ?? 'custom', input, values.out ?? 'bricko.stl');
  process.exit(ok ? 0 : 1);
}
