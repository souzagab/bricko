import { parseParams, type ClipParams } from '../../params/schema.ts';
import type { BuildResult } from './protocol.ts';

export type ViewMode = 'use' | 'print';

/** All UI state in one place (Svelte 5 runes). */
class AppState {
  params = $state<ClipParams>(parseParams({}));
  result = $state.raw<BuildResult | null>(null);
  busy = $state(false);
  ready = $state(false);
  error = $state<string | null>(null);
  advanced = $state(false);
  preset = $state('default');
  view = $state<ViewMode>('use');
  openAngle = $state(0);
  section = $state(1); // 1 = no cut
  focusKey = $state<string | null>(null);

  reset(to: Partial<ClipParams> = {}) {
    this.params = parseParams(to);
  }
}

export const app = new AppState();
