'use client';

import { useState } from 'react';
import type { SocialAlert } from '@prisma/client';
import { Field, TextInput, Select } from '../FormControls';

export function SocialManager({ guildId, initialAlerts, textChannels }: { guildId: string; initialAlerts: SocialAlert[]; textChannels: { id: string; name: string }[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [platform, setPlatform] = useState<'twitch' | 'youtube'>('twitch');
  const [handle, setHandle] = useState('');
  const [channelId, setChannelId] = useState(textChannels[0]?.id ?? '');
  const [creating, setCreating] = useState(false);

  async function addAlert() {
    if (!handle.trim() || !channelId) return;
    setCreating(true);
    const res = await fetch(`/api/guilds/${guildId}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, channelHandle: handle, announceChannelId: channelId })
    });
    const alert = (await res.json()) as SocialAlert;
    setAlerts((prev) => [...prev.filter((a) => a.id !== alert.id), alert]);
    setHandle('');
    setCreating(false);
  }

  async function removeAlert(id: string) {
    await fetch(`/api/guilds/${guildId}/social/${id}`, { method: 'DELETE' });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {alerts.length === 0 && <p className="text-sm text-discord-muted">No alerts configured.</p>}
        {alerts.map((a) => (
          <div key={a.id} className="card flex items-center justify-between p-4">
            <span className="text-white">
              <strong className="capitalize">{a.platform}</strong>: {a.channelHandle} → #{textChannels.find((c) => c.id === a.announceChannelId)?.name ?? a.announceChannelId}
            </span>
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => removeAlert(a.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="card grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
        <Field label="Platform">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value as 'twitch' | 'youtube')}>
            <option value="twitch">Twitch</option>
            <option value="youtube">YouTube</option>
          </Select>
        </Field>
        <Field label={platform === 'twitch' ? 'Twitch Login' : 'YouTube Channel ID'}>
          <TextInput value={handle} onChange={(e) => setHandle(e.target.value)} />
        </Field>
        <Field label="Announce In">
          <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
          <button className="btn-primary" disabled={creating || !handle.trim()} onClick={addAlert}>
            {creating ? 'Adding…' : '+ Add Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}
