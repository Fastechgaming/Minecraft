'use client';

import { useState } from 'react';
import type { MinecraftServer } from '@prisma/client';
import { Field, TextInput, Select } from '../FormControls';

export function MinecraftServerManager({
  guildId,
  channels,
  initial
}: {
  guildId: string;
  channels: { id: string; name: string }[];
  initial: MinecraftServer[];
}) {
  const [servers, setServers] = useState(initial);
  const [draft, setDraft] = useState({ name: '', edition: 'java', host: '', port: 25565, statusChannelId: '' });
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!draft.name.trim() || !draft.host.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/guilds/${guildId}/minecraft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    const server = await res.json();
    setServers((s) => [...s, server]);
    setDraft({ name: '', edition: 'java', host: '', port: 25565, statusChannelId: '' });
    setCreating(false);
  }

  async function remove(id: string) {
    setServers((s) => s.filter((x) => x.id !== id));
    await fetch(`/api/guilds/${guildId}/minecraft/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Add Server</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Name">
            <TextInput value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Survival" />
          </Field>
          <Field label="Edition">
            <Select value={draft.edition} onChange={(e) => setDraft((d) => ({ ...d, edition: e.target.value }))}>
              <option value="java">Java</option>
              <option value="bedrock">Bedrock</option>
            </Select>
          </Field>
          <Field label="Host">
            <TextInput value={draft.host} onChange={(e) => setDraft((d) => ({ ...d, host: e.target.value }))} placeholder="play.example.net" />
          </Field>
          <Field label="Port">
            <TextInput type="number" value={draft.port} onChange={(e) => setDraft((d) => ({ ...d, port: Number(e.target.value) }))} />
          </Field>
          <Field label="Status Channel">
            <Select value={draft.statusChannelId} onChange={(e) => setDraft((d) => ({ ...d, statusChannelId: e.target.value }))}>
              <option value="">None (no live panel)</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <button className="btn-primary self-start" disabled={creating} onClick={create}>
          {creating ? 'Adding…' : 'Add Server'}
        </button>
      </section>

      <div className="flex flex-col gap-2">
        {servers.length === 0 && <p className="text-discord-muted">No Minecraft servers connected yet.</p>}
        {servers.map((s) => (
          <div key={s.id} className="card flex items-center justify-between p-4">
            <div>
              <div className="font-semibold text-white">{s.name}</div>
              <div className="text-xs text-discord-muted">
                {s.edition} · {s.host}:{s.port}
              </div>
            </div>
            <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => remove(s.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
