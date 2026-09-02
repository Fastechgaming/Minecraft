'use client';

import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, Select, SaveBar } from '../FormControls';

export function TicketsForm({ guildId, initialSettings, textChannels }: { guildId: string; initialSettings: GuildSettings; textChannels: { id: string; name: string }[] }) {
  const [settings, setSettings] = useState(initialSettings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof GuildSettings>(key: K, value: GuildSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/guilds/${guildId}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    setSaving(false);
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <Field label="Transcript Log Channel">
          <Select value={settings.ticketLogChannelId ?? ''} onChange={(e) => update('ticketLogChannelId', e.target.value || null)}>
            <option value="">None</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Max Open Tickets per User">
          <TextInput type="number" value={settings.ticketMaxOpenPerUser} onChange={(e) => update('ticketMaxOpenPerUser', Number(e.target.value))} />
        </Field>
        <Field label="Idle Reminder (hours)">
          <TextInput type="number" value={settings.ticketReminderHours} onChange={(e) => update('ticketReminderHours', Number(e.target.value))} />
        </Field>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
