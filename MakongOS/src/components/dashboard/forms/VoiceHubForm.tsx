'use client';

import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, Select, SaveBar } from '../FormControls';

interface Props {
  guildId: string;
  initialSettings: GuildSettings;
  voiceChannels: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

export function VoiceHubForm({ guildId, initialSettings, voiceChannels, categories }: Props) {
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
        <Field label="Setup Channel" hint="Joining this voice channel creates a personal channel">
          <Select value={settings.voiceHubSetupChannelId ?? ''} onChange={(e) => update('voiceHubSetupChannelId', e.target.value || null)}>
            <option value="">None</option>
            {voiceChannels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category for New Channels">
          <Select value={settings.voiceHubCategoryId ?? ''} onChange={(e) => update('voiceHubCategoryId', e.target.value || null)}>
            <option value="">Same as setup channel</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Default Channel Name" hint="{user} is replaced with the owner's name">
          <TextInput value={settings.voiceHubDefaultName} onChange={(e) => update('voiceHubDefaultName', e.target.value)} />
        </Field>
        <Field label="Default Member Limit" hint="0 = unlimited">
          <TextInput type="number" value={settings.voiceHubDefaultLimit} onChange={(e) => update('voiceHubDefaultLimit', Number(e.target.value))} />
        </Field>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
