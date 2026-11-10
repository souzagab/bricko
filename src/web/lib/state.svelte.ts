import { parseParams, type ClipParams } from '../../params/schema.ts';
import { DEFAULT_CABLES, ROOM, cablesToParams, type Cable } from './cables.ts';
import type { BuildResult } from './protocol.ts';

export type ViewMode = 'use' | 'print';

/** All UI state in one place (Svelte 5 runes). */
class AppState {
  cables = $state<Cable[]>(DEFAULT_CABLES.map((c) => ({ ...c })));
  room = $state<number>(ROOM.easy);
  params = $state<ClipParams>(parseParams(cablesToParams(DEFAULT_CABLES, ROOM.easy)));
  result = $state.raw<BuildResult | null>(null);
  busy = $state(false);
  ready = $state(false);
  error = $state<string | null>(null);
  showAdvanced = $state(false);
  view = $state<ViewMode>('use');
  openAngle = $state(0);
  section = $state(1); // 1 = no cut
  focusKey = $state<string | null>(null);
  testPrint = $state(false);
  toast = $state<string | null>(null);

  /** Back to a fresh clip: default cables, default everything. */
  reset() {
    this.cables = DEFAULT_CABLES.map((c) => ({ ...c }));
    this.room = ROOM.easy;
    this.params = parseParams(cablesToParams(this.cables, this.room));
  }
}

export const app = new AppState();
