'use client';

import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, Select, ToggleRow, MultiRoleSelect, MultiPillSelect, SaveBar } from '../FormControls';

interface Props {
  guildId: string;
  initialSettings: GuildSettings;
  roles: { id: string; name: string }[];
  textChannels: { id: string; name: string }[];
}

export function ModerationForm({ guildId, initialSettings, roles, textChannels }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [badWordsInput, setBadWordsInput] = useState(initialSettings.automodBadWords.join(', '));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof GuildSettings>(key: K, value: GuildSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const payload = { ...settings, automodBadWords: badWordsInput.split(',').map((w) => w.trim()).filter(Boolean) };
    await fetch(`/api/guilds/${guildId}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-2 p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-discord-muted">Automod</h2>
        <ToggleRow label="Block Invite Links" checked={settings.automodBlockInvites} onChange={(v) => update('automodBlockInvites', v)} />
        <ToggleRow label="Block Bad Words" checked={settings.automodBlockBadWords} onChange={(v) => update('automodBlockBadWords', v)} />
        <ToggleRow label="Block Spam Bursts" checked={settings.automodBlockSpam} onChange={(v) => update('automodBlockSpam', v)} />
        <ToggleRow label="Detect Ghost Pings" checked={settings.automodBlockGhostPing} onChange={(v) => update('automodBlockGhostPing', v)} />
      </div>

      <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <Field label="Blocked Words" hint="Comma separated">
          <TextInput value={badWordsInput} onChange={(e) => { setBadWordsInput(e.target.value); setDirty(true); }} />
        </Field>
        <Field label="Mod Log Channel">
          <Select value={settings.modLogChannelId ?? ''} onChange={(e) => update('modLogChannelId', e.target.value || null)}>
            <option value="">None</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Spam Message Threshold">
          <TextInput type="number" value={settings.automodSpamMsgCount} onChange={(e) => update('automodSpamMsgCount', Number(e.target.value))} />
        </Field>
        <Field label="Spam Window (seconds)">
          <TextInput type="number" value={settings.automodSpamWindowSec} onChange={(e) => update('automodSpamWindowSec', Number(e.target.value))} />
        </Field>
        <Field label="Warning Decay (days)">
          <TextInput type="number" value={settings.warningDecayDays} onChange={(e) => update('warningDecayDays', Number(e.target.value))} />
        </Field>
        <Field label="Automod Whitelisted Roles">
          <MultiRoleSelect roles={roles} value={settings.automodWhitelistRoleIds} onChange={(v) => update('automodWhitelistRoleIds', v)} />
        </Field>
        <Field label="Automod Whitelisted Channels">
          <MultiPillSelect options={textChannels} value={settings.automodWhitelistChannelIds} onChange={(v) => update('automodWhitelistChannelIds', v)} prefix="#" />
        </Field>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <h2 className="col-span-full mb-1 text-sm font-semibold uppercase tracking-wide text-discord-muted">AI Anti-Scam</h2>
        <Field label="Action on Detection">
          <Select value={settings.antiScamAction} onChange={(e) => update('antiScamAction', e.target.value)}>
            <option value="timeout">Timeout</option>
            <option value="kick">Kick</option>
            <option value="ban">Ban</option>
          </Select>
        </Field>
        <Field label="Timeout Duration (minutes)">
          <TextInput type="number" value={settings.antiScamTimeoutMin} onChange={(e) => update('antiScamTimeoutMin', Number(e.target.value))} />
        </Field>
        <Field label="Anti-Scam Whitelisted Roles">
          <MultiRoleSelect roles={roles} value={settings.antiScamWhitelistRoleIds} onChange={(v) => update('antiScamWhitelistRoleIds', v)} />
        </Field>
        <Field label="Anti-Scam Whitelisted Channels">
          <MultiPillSelect options={textChannels} value={settings.antiScamWhitelistChannelIds} onChange={(v) => update('antiScamWhitelistChannelIds', v)} prefix="#" />
        </Field>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
