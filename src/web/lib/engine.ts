import type { ClipParamsInput } from '../../params/schema.ts';
import type { BuildResult, WorkerRequest, WorkerResponse } from './protocol.ts';
import type { CouponResult } from '../../coupon.ts';

/**
 * Talks to the geometry worker. Latest-wins: while one build runs, only the
 * newest request is kept, so dragging a slider never piles up work.
 */
export class Engine {
  private worker: Worker;
  private running = false;
  private queued: ClipParamsInput | null = null;
  private seq = 0;
  private coupons = new Map<number, { resolve: (r: CouponResult) => void; reject: (e: Error) => void }>();

  private on: {
    ready?: () => void;
    result: (r: BuildResult) => void;
    error: (message: string) => void;
    busy: (busy: boolean) => void;
  };

  constructor(on: Engine['on']) {
    this.on = on;
    this.worker = new Worker(new URL('../worker/geometry.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'ready') { this.on.ready?.(); return; }
      if (msg.type === 'coupon' || (msg.type === 'error' && msg.kind === 'coupon')) {
        const p = this.coupons.get(msg.id);
        this.coupons.delete(msg.id);
        if (msg.type === 'coupon') p?.resolve(msg.result);
        else p?.reject(new Error(msg.message));
        return;
      }
      if (msg.type === 'result') this.on.result(msg.result);
      else this.on.error(msg.message);
      this.running = false;
      if (this.queued) {
        const next = this.queued;
        this.queued = null;
        this.send(next);
      } else this.on.busy(false);
    };
    this.worker.onerror = (e) => {
      this.running = false;
      this.on.busy(false);
      this.on.error(e.message || 'The geometry worker crashed.');
    };
  }

  request(params: ClipParamsInput): void {
    if (this.running) { this.queued = params; return; }
    this.send(params);
  }

  private send(params: ClipParamsInput): void {
    this.running = true;
    this.on.busy(true);
    const req: WorkerRequest = { id: ++this.seq, kind: 'clip', params };
    this.worker.postMessage(req);
  }

  /** Build the test print around the given settings. */
  coupon(params: ClipParamsInput): Promise<CouponResult> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.coupons.set(id, { resolve, reject });
      const req: WorkerRequest = { id, kind: 'coupon', params };
      this.worker.postMessage(req);
    });
  }
}
