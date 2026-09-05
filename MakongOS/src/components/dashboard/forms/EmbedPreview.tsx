'use client';

import type { PanelEmbedData } from '../../../tickets/panelTypes';

function colorHex(color?: number): string {
  return `#${(color ?? 0x22c55e).toString(16).padStart(6, '0')}`;
}

export function EmbedPreview({ embed }: { embed: PanelEmbedData }) {
  return (
    <div className="flex gap-3 rounded-lg bg-discord-panel2 p-3" style={{ borderLeft: `4px solid ${colorHex(embed.color)}` }}>
      <div className="min-w-0 flex-1">
        {embed.title && <div className="font-semibold text-white">{embed.title}</div>}
        {embed.description && <div className="mt-1 whitespace-pre-wrap text-sm text-discord-muted">{embed.description}</div>}
        {embed.footerText && <div className="mt-2 text-xs text-discord-muted">{embed.footerText}</div>}
      </div>
      {embed.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={embed.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
      )}
    </div>
  );
}
