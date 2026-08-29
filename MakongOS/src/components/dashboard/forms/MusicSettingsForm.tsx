'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, ToggleRow, MultiPillSelect, SaveBar } from '../FormControls';

export function MusicSettingsForm({ guildId, initial, channels }: { guildId: string; initial: GuildSettings; channels: { id: string; name: string }[] }) {
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
        <ToggleRow label="Music Enabled" checked={form.musicEnabled} onChange={(v) => set('musicEnabled', v)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Max Queue Length">
            <TextInput type="number" min={1} value={form.musicMaxQueue} onChange={(e) => set('musicMaxQueue', Number(e.target.value))} />
          </Field>
          <Field label="Default Volume (%)">
            <TextInput type="number" min={0} max={100} value={form.musicDefaultVol} onChange={(e) => set('musicDefaultVol', Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Allowed Channels" hint="Leave empty to allow music commands anywhere">
          <MultiPillSelect options={channels} value={form.musicChannelIds} onChange={(v) => set('musicChannelIds', v)} prefix="#" />
        </Field>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
