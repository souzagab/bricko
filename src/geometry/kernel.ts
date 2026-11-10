import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';

let wasm: Promise<ManifoldToplevel> | null = null;
let config: { locateFile: () => string } | undefined;

/** Browser builds pass the bundled .wasm URL here before the first getKernel(). */
export function configureKernel(opts: { wasmUrl: string }): void {
  config = { locateFile: () => opts.wasmUrl };
}

/** Loads the Manifold WASM module once. Works in Node and in a browser worker. */
export function getKernel(): Promise<ManifoldToplevel> {
  wasm ??= Module(config).then((m) => {
    m.setup();
    return m;
  });
  return wasm;
}

interface Deletable { delete(): void }

/**
 * WASM objects are not garbage collected. Pass every intermediate through
 * `t()`, then call `free()` once the result has been extracted. Anything given
 * to `keep()` survives.
 */
export class Scope {
  private items = new Set<Deletable>();
  private kept = new Set<Deletable>();
  t = <T extends Deletable>(x: T): T => {
    this.items.add(x);
    return x;
  };
  keep = <T extends Deletable>(x: T): T => {
    this.kept.add(x);
    return x;
  };
  free(): void {
    for (const x of this.items) if (!this.kept.has(x)) x.delete();
    this.items.clear();
  }
}
