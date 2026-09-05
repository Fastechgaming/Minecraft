'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TicketPanel, TicketCategory } from '@prisma/client';
import { Select, TextInput } from '../FormControls';
import { EmbedPreview } from './EmbedPreview';
import { parsePanelEmbeds } from '../../../tickets/panelTypes';

type PanelWithOptions = TicketPanel & { categories: TicketCategory[] };

export function PanelsList({ guildId, initialPanels, textChannels }: { guildId: string; initialPanels: PanelWithOptions[]; textChannels: { id: string; name: string }[] }) {
  const router = useRouter();
  const [panels, setPanels] = useState(initialPanels);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [newChannelId, setNewChannelId] = useState(textChannels[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? panels.filter((p) => {
          const embeds = parsePanelEmbeds(p.embeds);
          return embeds.some((e) => e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q));
        })
      : panels;
    return [...filtered].sort((a, b) => (sort === 'newest' ? b.lastSeenAt.valueOf() - a.lastSeenAt.valueOf() : a.lastSeenAt.valueOf() - b.lastSeenAt.valueOf()));
  }, [panels, search, sort]);

  async function createPanel() {
    if (!newChannelId) return;
    setCreating(true);
    const res = await fetch(`/api/guilds/${guildId}/tickets/panels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: newChannelId })
    });
    const panel = (await res.json()) as TicketPanel;
    setCreating(false);
    router.push(`/dashboard/${guildId}/tickets/panels/${panel.id}`);
  }

  async function resend(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/guilds/${guildId}/tickets/panels/${id}/resend`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, lastSeenAt: new Date() } : p)));
  }

  async function move(id: string) {
    if (!moveTarget) return;
    setBusyId(id);
    const res = await fetch(`/api/guilds/${guildId}/tickets/panels/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: moveTarget })
    });
    setBusyId(null);
    if (res.ok) {
      setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, channelId: moveTarget, lastSeenAt: new Date() } : p)));
      setMovingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this panel and all of its options? This cannot be undone.')) return;
    setBusyId(id);
    await fetch(`/api/guilds/${guildId}/tickets/panels/${id}`, { method: 'DELETE' });
    setBusyId(null);
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Panels</h1>
          <p className="text-discord-muted">Manage and view all your panels.</p>
        </div>
        <div className="text-right text-discord-muted">
          <span className="text-xl font-bold text-white">{panels.length}</span> Panels
        </div>
      </div>

      <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by panel content or title..." />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')} className="w-auto">
          <option value="newest">Sort: Last Seen (Newest First)</option>
          <option value="oldest">Sort: Last Seen (Oldest First)</option>
        </Select>
        <Select value={newChannelId} onChange={(e) => setNewChannelId(e.target.value)} className="w-auto">
          {textChannels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </Select>
        <button className="btn-primary" disabled={creating || !newChannelId} onClick={createPanel}>
          {creating ? 'Creating…' : '+ Create Panel'}
        </button>
      </div>

      {visible.length === 0 && <p className="card p-4 text-sm text-discord-muted">No panels yet — create one above.</p>}

      {visible.map((panel) => {
        const embeds = parsePanelEmbeds(panel.embeds);
        const channel = textChannels.find((c) => c.id === panel.channelId);
        return (
          <div key={panel.id} className="card flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/dashboard/${guildId}/tickets/panels/${panel.id}`} className="btn-secondary">
                ✏️ Edit
              </a>
              <button className="btn-secondary" onClick={() => setMovingId(movingId === panel.id ? null : panel.id)}>
                ⇄ Move
              </button>
              <button className="btn-secondary" disabled={busyId === panel.id} onClick={() => resend(panel.id)}>
                ➤ Resend
              </button>
              <button className="btn-danger" disabled={busyId === panel.id} onClick={() => remove(panel.id)}>
                🗑 Delete
              </button>
            </div>

            {movingId === panel.id && (
              <div className="flex items-center gap-2 rounded-lg bg-discord-panel2 p-2">
                <Select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} className="w-auto">
                  <option value="">Select a channel...</option>
                  {textChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </Select>
                <button className="btn-primary px-3 py-1 text-xs" disabled={!moveTarget || busyId === panel.id} onClick={() => move(panel.id)}>
                  Confirm Move
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-discord-muted">
              <span>
                Last Seen <strong className="text-white">{panel.lastSeenAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}</strong>
              </span>
              <div className="flex gap-2">
                <span className="pill bg-discord-yellow/20 text-discord-yellow">Ticket Panel</span>
                <span className="pill bg-discord-blurple/20 text-discord-blurple"># {channel ? channel.name : 'Unknown Channel'}</span>
              </div>
            </div>

            {embeds.map((e, i) => (
              <EmbedPreview key={i} embed={e} />
            ))}
            {panel.categories.length === 0 && <p className="text-xs text-discord-muted">No options yet — open the editor to add buttons or a dropdown.</p>}
          </div>
        );
      })}
    </div>
  );
}
