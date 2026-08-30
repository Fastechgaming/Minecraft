'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, SaveBar } from '../FormControls';

export function EconomySettingsForm({ guildId, initial }: { guildId: string; initial: GuildSettings }) {
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
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Currency & Rewards</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Currency Symbol">
            <TextInput value={form.economyCurrencySymbol} onChange={(e) => set('economyCurrencySymbol', e.target.value)} maxLength={4} />
          </Field>
          <Field label="Daily Reward Amount">
            <TextInput type="number" min={0} value={form.economyDailyAmount} onChange={(e) => set('economyDailyAmount', Number(e.target.value))} />
          </Field>
          <Field label="Beg Cooldown (seconds)">
            <TextInput type="number" min={0} value={form.economyBegCooldownSec} onChange={(e) => set('economyBegCooldownSec', Number(e.target.value))} />
          </Field>
          <Field label="Beg Minimum Amount">
            <TextInput type="number" min={0} value={form.economyBegMin} onChange={(e) => set('economyBegMin', Number(e.target.value))} />
          </Field>
          <Field label="Beg Maximum Amount">
            <TextInput type="number" min={0} value={form.economyBegMax} onChange={(e) => set('economyBegMax', Number(e.target.value))} />
          </Field>
        </div>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
