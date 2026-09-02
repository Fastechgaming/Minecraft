'use client';

import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, Select, ToggleRow, MultiRoleSelect, SaveBar } from '../FormControls';

interface Props {
  guildId: string;
  initialSettings: GuildSettings;
  roles: { id: string; name: string }[];
  textChannels: { id: string; name: string }[];
}

export function CommunityForm({ guildId, initialSettings, roles, textChannels }: Props) {
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
      <div className="card flex flex-col gap-3 p-4">
        <ToggleRow label="Welcome Messages" checked={settings.welcomeEnabled} onChange={(v) => update('welcomeEnabled', v)} />
        <Field label="Welcome Channel">
          <Select value={settings.welcomeChannelId ?? ''} onChange={(e) => update('welcomeChannelId', e.target.value || null)}>
            <option value="">None</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Welcome Message" hint="{user} and {server} are replaced">
          <TextInput value={settings.welcomeMessage} onChange={(e) => update('welcomeMessage', e.target.value)} />
        </Field>
      </div>

      <div className="card flex flex-col gap-3 p-4">
        <ToggleRow label="Leave Messages" checked={settings.leaveEnabled} onChange={(v) => update('leaveEnabled', v)} />
        <Field label="Leave Channel">
          <Select value={settings.leaveChannelId ?? ''} onChange={(e) => update('leaveChannelId', e.target.value || null)}>
            <option value="">None</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Leave Message">
          <TextInput value={settings.leaveMessage} onChange={(e) => update('leaveMessage', e.target.value)} />
        </Field>
      </div>

      <div className="card p-4">
        <Field label="Auto Roles" hint="Automatically given to new members">
          <MultiRoleSelect roles={roles} value={settings.autoRoleIds} onChange={(v) => update('autoRoleIds', v)} />
        </Field>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
