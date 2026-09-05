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

const FEATURE_TOGGLES: { key: keyof GuildSettings; label: string; description: string }[] = [
  { key: 'moderationEnabled', label: 'Moderation', description: 'Automod, AI anti-scam, case management, temp roles' },
  { key: 'aiEnabled', label: 'AI Assistant', description: 'Gemini chat, knowledge base, /imagine' },
  { key: 'musicEnabled', label: 'Music', description: 'Queue-based playback with filters' },
  { key: 'levelingEnabled', label: 'Leveling', description: 'Text + voice XP and rank cards' },
  { key: 'economyEnabled', label: 'Economy', description: 'Currency, shop, gambling minigames' },
  { key: 'voiceHubEnabled', label: 'Voice Hub', description: 'Join-to-create temporary voice channels' },
  { key: 'giveawaysEnabled', label: 'Giveaways', description: 'Button-based giveaways' },
  { key: 'reactionRolesEnabled', label: 'Reaction Roles', description: 'Dropdown self-assign role panels' },
  { key: 'socialAlertsEnabled', label: 'Social Alerts', description: 'Twitch/YouTube live & upload alerts' }
];

export function ServerGeneralForm({ guildId, initialSettings, roles, textChannels }: Props) {
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
      <div className="card flex flex-col gap-2 p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-discord-muted">Feature Modules</h2>
        {FEATURE_TOGGLES.map((toggle) => (
          <ToggleRow
            key={toggle.key}
            label={toggle.label}
            description={toggle.description}
            checked={Boolean(settings[toggle.key])}
            onChange={(v) => update(toggle.key, v as never)}
          />
        ))}
      </div>

      <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <Field label="Command Prefix" hint="Used for text-based fallback commands">
          <TextInput value={settings.prefix} onChange={(e) => update('prefix', e.target.value)} maxLength={5} />
        </Field>
        <Field label="Audit Log Channel">
          <Select value={settings.logChannelId ?? ''} onChange={(e) => update('logChannelId', e.target.value || null)}>
            <option value="">None</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Staff Roles" hint="Can use moderation and giveaway management commands">
          <MultiRoleSelect roles={roles} value={settings.staffRoleIds} onChange={(v) => update('staffRoleIds', v)} />
        </Field>
        <Field label="Admin Roles" hint="Can change server settings and manage backups/vouchers">
          <MultiRoleSelect roles={roles} value={settings.adminRoleIds} onChange={(v) => update('adminRoleIds', v)} />
        </Field>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
