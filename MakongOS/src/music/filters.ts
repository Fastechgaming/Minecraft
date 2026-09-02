export type FilterName = 'bassboost' | 'nightcore' | '8d' | 'vaporwave' | 'tremolo';

export const FILTER_LABELS: Record<FilterName, string> = {
  bassboost: 'Bassboost',
  nightcore: 'Nightcore',
  '8d': '8D Audio',
  vaporwave: 'Vaporwave',
  tremolo: 'Tremolo'
};

const FILTER_CHAINS: Record<FilterName, string> = {
  bassboost: 'bass=g=15',
  nightcore: 'asetrate=48000*1.25,aresample=48000,atempo=1.06',
  '8d': 'apulsator=hz=0.09',
  vaporwave: 'asetrate=48000*0.8,aresample=48000,atempo=0.9',
  tremolo: 'tremolo=f=5:d=0.6'
};

export function buildAudioFilterChain(volumePercent: number, filter: FilterName | null): string {
  const parts = [`volume=${Math.max(0, Math.min(200, volumePercent)) / 100}`];
  if (filter) parts.push(FILTER_CHAINS[filter]);
  return parts.join(',');
}
