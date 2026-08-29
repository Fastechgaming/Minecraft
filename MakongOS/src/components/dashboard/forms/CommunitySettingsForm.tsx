'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, ToggleRow, SaveBar } from '../FormControls';

export function CommunitySettingsForm({ guildId, initial }: { guildId: string; initial: GuildSettings }) {
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
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">XP & Levels</h2>
        <ToggleRow label="Leveling Enabled" checked={form.levelingEnabled} onChange={(v) => set('levelingEnabled', v)} />
        <ToggleRow label="Games Enabled" checked={form.gamesEnabled} onChange={(v) => set('gamesEnabled', v)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="XP per Message">
            <TextInput type="number" min={0} value={form.xpPerMessage} onChange={(e) => set('xpPerMessage', Number(e.target.value))} />
          </Field>
          <Field label="Message XP Cooldown (s)">
            <TextInput type="number" min={0} value={form.xpCooldownSec} onChange={(e) => set('xpCooldownSec', Number(e.target.value))} />
          </Field>
          <Field label="XP per Voice Minute">
            <TextInput type="number" min={0} value={form.xpPerVoiceMin} onChange={(e) => set('xpPerVoiceMin', Number(e.target.value))} />
          </Field>
          <Field label="Level-up Difficulty" hint="Higher = more XP needed per level">
            <TextInput type="number" min={1} value={form.xpLevelUpBase} onChange={(e) => set('xpLevelUpBase', Number(e.target.value))} />
          </Field>
        </div>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
