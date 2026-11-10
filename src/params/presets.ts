import type { ClipParamsInput } from './schema.ts';

/** Starting points. Cable sizes are typical outer diameters plus a little room. */
export const PRESETS: Record<string, { label: string; params: ClipParamsInput }> = {
  default: { label: '2 channels · 2 studs wide (like the original)', params: {} },
  usbc: { label: 'USB-C cables (4 mm)', params: { channelCount: 3, channelWidth: 6, channelHeight: 6.5 } },
  power: { label: 'Power cables (8 mm)', params: { channelCount: 2, channelWidth: 10, channelHeight: 9.15 } },
  hdmi: { label: 'HDMI (8 mm)', params: { channelCount: 1, channelWidth: 10, channelHeight: 9.15 } },
  bundle: { label: 'Big bundle', params: { channelCount: 1, channelWidth: 28, channelHeight: 14, studsAcross: 3 } },
  slim: { label: '1 stud wide', params: { studsAcross: 1, channelCount: 2, channelWidth: 8, channelHeight: 7 } },
  mixed: { label: 'Mixed sizes', params: { channelCount: 3, channelWidths: [6, 10, 14], channelHeight: 9.15 } },
  snap: { label: 'Snap dividers', params: { dividerSnap: true } },
  original: { label: 'Original tolerances (tuned printers)', params: { clearance: 0.2, brickPlay: 0.3, elephantFoot: 0 } },
};
