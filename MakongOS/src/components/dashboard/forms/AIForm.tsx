'use client';

import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, Select, MultiPillSelect, SaveBar } from '../FormControls';

export function AIForm({ guildId, initialSettings, textChannels }: { guildId: string; initialSettings: GuildSettings; textChannels: { id: string; name: string }[] }) {
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
        <Field label="Personality Mode">
          <Select value={settings.aiMode} onChange={(e) => update('aiMode', e.target.value)}>
            <option value="staff">Staff — professional & concise</option>
            <option value="friend">Friend — casual & chatty</option>
            <option value="hybrid">Hybrid — friendly but accurate</option>
          </Select>
        </Field>
        <Field label="Escalation Channel" hint="Where unanswered questions get sent to staff">
          <Select value={settings.aiEscalationChannelId ?? ''} onChange={(e) => update('aiEscalationChannelId', e.target.value || null)}>
            <option value="">Same channel as the question</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Custom Personality Notes" hint="Optional extra instructions for the AI">
          <TextInput value={settings.aiPersonality ?? ''} onChange={(e) => update('aiPersonality', e.target.value || null)} />
        </Field>
        <Field label="Always-On Chat Channels" hint="AI responds to every message here, not just @mentions">
          <MultiPillSelect options={textChannels} value={settings.aiChatChannelIds} onChange={(v) => update('aiChatChannelIds', v)} prefix="#" />
        </Field>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
