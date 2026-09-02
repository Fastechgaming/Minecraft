'use client';

import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, Select, SaveBar } from '../FormControls';

type LevelReward = { level: number; roleId: string };

interface Props {
  guildId: string;
  initialSettings: GuildSettings;
  roles: { id: string; name: string }[];
  textChannels: { id: string; name: string }[];
}

export function LevelingForm({ guildId, initialSettings, roles, textChannels }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [rewards, setRewards] = useState<LevelReward[]>((initialSettings.levelRoleRewards as unknown as LevelReward[]) ?? []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof GuildSettings>(key: K, value: GuildSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
  }

  function addReward() {
    setRewards((r) => [...r, { level: 5, roleId: roles[0]?.id ?? '' }]);
    setDirty(true);
  }

  function removeReward(index: number) {
    setRewards((r) => r.filter((_, i) => i !== index));
    setDirty(true);
  }

  function updateReward(index: number, patch: Partial<LevelReward>) {
    setRewards((r) => r.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const payload = { ...settings, levelRoleRewards: rewards };
    await fetch(`/api/guilds/${guildId}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <Field label="XP per Message">
          <TextInput type="number" value={settings.xpPerMessage} onChange={(e) => update('xpPerMessage', Number(e.target.value))} />
        </Field>
        <Field label="Text XP Cooldown (seconds)">
          <TextInput type="number" value={settings.xpCooldownSec} onChange={(e) => update('xpCooldownSec', Number(e.target.value))} />
        </Field>
        <Field label="XP per Voice Minute">
          <TextInput type="number" value={settings.xpPerVoiceMin} onChange={(e) => update('xpPerVoiceMin', Number(e.target.value))} />
        </Field>
        <Field label="Level Curve Base" hint="Higher = slower leveling">
          <TextInput type="number" value={settings.xpLevelUpBase} onChange={(e) => update('xpLevelUpBase', Number(e.target.value))} />
        </Field>
        <Field label="Level-Up Announcement Channel">
          <Select value={settings.levelUpChannelId ?? ''} onChange={(e) => update('levelUpChannelId', e.target.value || null)}>
            <option value="">None</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="card flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Level Role Rewards</h2>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={addReward}>
            + Add Reward
          </button>
        </div>
        {rewards.length === 0 && <p className="text-sm text-discord-muted">No role rewards configured.</p>}
        {rewards.map((reward, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-discord-panel2 px-3 py-2">
            <span className="text-xs text-discord-muted">Level</span>
            <TextInput type="number" className="w-20" value={reward.level} onChange={(e) => updateReward(i, { level: Number(e.target.value) })} />
            <span className="text-xs text-discord-muted">Role</span>
            <Select className="flex-1" value={reward.roleId} onChange={(e) => updateReward(i, { roleId: e.target.value })}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => removeReward(i)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
