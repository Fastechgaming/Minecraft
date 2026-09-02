'use client';

import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, ToggleRow, SaveBar } from '../FormControls';

export function EconomyForm({ guildId, initialSettings }: { guildId: string; initialSettings: GuildSettings }) {
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
        <Field label="Currency Name">
          <TextInput value={settings.economyCurrencyName} onChange={(e) => update('economyCurrencyName', e.target.value)} />
        </Field>
        <Field label="Currency Symbol">
          <TextInput value={settings.economyCurrencySymbol} onChange={(e) => update('economyCurrencySymbol', e.target.value)} maxLength={4} />
        </Field>
        <Field label="Daily Base Amount">
          <TextInput type="number" value={settings.economyDailyAmount} onChange={(e) => update('economyDailyAmount', Number(e.target.value))} />
        </Field>
        <Field label="Work Min / Max">
          <div className="flex gap-2">
            <TextInput type="number" value={settings.economyWorkMin} onChange={(e) => update('economyWorkMin', Number(e.target.value))} />
            <TextInput type="number" value={settings.economyWorkMax} onChange={(e) => update('economyWorkMax', Number(e.target.value))} />
          </div>
        </Field>
        <Field label="Rob Success Rate" hint="0.0 - 1.0">
          <TextInput type="number" step="0.05" min={0} max={1} value={settings.economyRobSuccessRate} onChange={(e) => update('economyRobSuccessRate', Number(e.target.value))} />
        </Field>
      </div>
      <div className="card p-4">
        <ToggleRow label="Enable Robbing" description="Allow /rob between members" checked={settings.economyRobEnabled} onChange={(v) => update('economyRobEnabled', v)} />
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
