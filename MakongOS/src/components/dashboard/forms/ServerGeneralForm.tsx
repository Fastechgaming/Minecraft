'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, Select, ToggleRow, MultiRoleSelect, SaveBar } from '../FormControls';

interface Props {
  guildId: string;
  initial: GuildSettings;
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  botOnline: boolean;
}

export function ServerGeneralForm({ guildId, initial, channels, roles, botOnline }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof GuildSettings>(key: K, value: GuildSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/guilds/${guildId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setSaving(false);
    setDirty(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      {!botOnline && (
        <div className="card border-discord-yellow/40 bg-discord-yellow/10 p-3 text-sm text-discord-yellow">
          The bot is currently offline, so channel and role names couldn&apos;t be loaded. IDs already saved are preserved.
        </div>
      )}

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Identity</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Prefix">
            <TextInput value={form.prefix} onChange={(e) => set('prefix', e.target.value)} maxLength={5} />
          </Field>
          <Field label="Language">
            <TextInput value={form.language} onChange={(e) => set('language', e.target.value)} />
          </Field>
          <Field label="Timezone">
            <TextInput value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
          </Field>
          <Field label="Embed Color">
            <input type="color" value={form.embedColor} onChange={(e) => set('embedColor', e.target.value)} className="h-10 w-full rounded-lg border border-discord-border bg-discord-darker" />
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Channels</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Audit Log Channel">
            <Select value={form.logChannelId ?? ''} onChange={(e) => set('logChannelId', e.target.value || null)}>
              <option value="">Not set</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="AI Escalation Channel">
            <Select value={form.aiEscalationChannel ?? ''} onChange={(e) => set('aiEscalationChannel', e.target.value || null)}>
              <option value="">Not set</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Suggestions Channel">
            <Select value={form.suggestionsChannelId ?? ''} onChange={(e) => set('suggestionsChannelId', e.target.value || null)}>
              <option value="">Not set (posts in the channel /suggest was used in)</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Ticket Log Channel">
            <Select value={form.ticketLogChannelId ?? ''} onChange={(e) => set('ticketLogChannelId', e.target.value || null)}>
              <option value="">Not set</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Roles</h2>
        <Field label="Staff Roles" hint="Can claim/close tickets, review suggestions, and are considered staff by the AI escalation flow">
          <MultiRoleSelect roles={roles} value={form.staffRoleIds} onChange={(v) => set('staffRoleIds', v)} />
        </Field>
        <Field label="Admin Roles" hint="Full dashboard-equivalent control in Discord commands">
          <MultiRoleSelect roles={roles} value={form.adminRoleIds} onChange={(v) => set('adminRoleIds', v)} />
        </Field>
        <Field label="DJ Roles" hint="Leave empty to let anyone control music">
          <MultiRoleSelect roles={roles} value={form.djRoleIds} onChange={(v) => set('djRoleIds', v)} />
        </Field>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Feature Toggles</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ToggleRow label="AI Staff Assistant" checked={form.aiEnabled} onChange={(v) => set('aiEnabled', v)} />
          <ToggleRow label="Music" checked={form.musicEnabled} onChange={(v) => set('musicEnabled', v)} />
          <ToggleRow label="Tickets" checked={form.ticketsEnabled} onChange={(v) => set('ticketsEnabled', v)} />
          <ToggleRow label="Economy" checked={form.economyEnabled} onChange={(v) => set('economyEnabled', v)} />
          <ToggleRow label="Fun Commands" checked={form.funEnabled} onChange={(v) => set('funEnabled', v)} />
          <ToggleRow label="Suggestions" checked={form.suggestionsEnabled} onChange={(v) => set('suggestionsEnabled', v)} />
          <ToggleRow label="Giveaways" checked={form.giveawaysEnabled} onChange={(v) => set('giveawaysEnabled', v)} />
          <ToggleRow label="Leveling / XP" checked={form.levelingEnabled} onChange={(v) => set('levelingEnabled', v)} />
        </div>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
