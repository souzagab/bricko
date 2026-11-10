/// Geometry runs here so the page never freezes while a clip is built.
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { configureKernel, getKernel } from '../../geometry/kernel.ts';
import { generate } from '../../generate.ts';
import { generateCoupon } from '../../coupon.ts';
import type { WorkerRequest, WorkerResponse } from '../lib/protocol.ts';

configureKernel({ wasmUrl });

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(msg: WorkerResponse, transfer?: Transferable[]): void;
};

// Warm up the WASM module before the first request arrives
getKernel().then(() => ctx.postMessage({ type: 'ready' }));

ctx.onmessage = async (e) => {
  const { id, kind, params } = e.data;
  try {
    if (kind === 'coupon') {
      const c = await generateCoupon(params);
      ctx.postMessage({ type: 'coupon', id, result: c }, [
        c.meshes.base.vertProperties.buffer, c.meshes.base.triVerts.buffer, c.meshes.arm.vertProperties.buffer, c.meshes.arm.triVerts.buffer,
      ]);
      return;
    }
    const r = await generate(params);
    const transfer: Transferable[] = [];
    if (r.meshes) {
      for (const m of [r.meshes.base, r.meshes.arm]) transfer.push(m.vertProperties.buffer, m.triVerts.buffer);
    }
    ctx.postMessage({
      type: 'result', id,
      result: {
        params: r.params, issues: r.issues, report: r.report, meshes: r.meshes, shift: r.shift, ms: r.ms,
        hy: r.derived.hy, W: r.derived.W, clearance: r.derived.c,
      },
    }, transfer);
  } catch (err) {
    ctx.postMessage({ type: 'error', id, kind, message: err instanceof Error ? err.message : String(err) });
  }
};
