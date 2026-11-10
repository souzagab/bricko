import type { ClipParamsInput } from './schema.ts';

/** Starting points. Cable sizes are typical outer diameters plus a little room. */
export const PRESETS: Record<string, { label: string; params: ClipParamsInput }> = {
  default: { label: '2 channels · 2 studs wide', params: {} },
  usbc: { label: 'USB-C cables (4 mm)', params: { channelCount: 3, channelWidth: 6, channelHeight: 5 } },
  power: { label: 'Power cables (8 mm)', params: { channelCount: 2, channelWidth: 10, channelHeight: 9 } },
  hdmi: { label: 'HDMI (8 mm)', params: { channelCount: 1, channelWidth: 10, channelHeight: 9 } },
  bundle: { label: 'Big bundle', params: { channelCount: 1, channelWidth: 30, channelHeight: 14, studsAcross: 3 } },
  slim: { label: '1 stud wide', params: { studsAcross: 1, channelCount: 2, channelWidth: 8, channelHeight: 6 } },
  mixed: { label: 'Mixed sizes', params: { channelCount: 3, channelWidths: [5, 8, 12], channelHeight: 9 } },
  side: { label: 'Side print (original orientation)', params: { orientation: 'side' } },
};
