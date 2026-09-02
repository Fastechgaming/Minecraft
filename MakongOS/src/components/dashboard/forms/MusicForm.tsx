'use client';

import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, MultiRoleSelect, SaveBar } from '../FormControls';

export function MusicForm({ guildId, initialSettings, roles }: { guildId: string; initialSettings: GuildSettings; roles: { id: string; name: string }[] }) {
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
        <Field label="Max Queue Size">
          <TextInput type="number" value={settings.musicMaxQueue} onChange={(e) => update('musicMaxQueue', Number(e.target.value))} />
        </Field>
        <Field label="Default Volume (%)">
          <TextInput type="number" value={settings.musicDefaultVol} onChange={(e) => update('musicDefaultVol', Number(e.target.value))} />
        </Field>
        <Field label="DJ Roles" hint="Leave empty to let everyone control music">
          <MultiRoleSelect roles={roles} value={settings.musicDjRoleIds} onChange={(v) => update('musicDjRoleIds', v)} />
        </Field>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
