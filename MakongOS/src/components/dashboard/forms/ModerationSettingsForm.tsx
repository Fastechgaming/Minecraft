'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, ToggleRow, MultiPillSelect, SaveBar } from '../FormControls';

export function ModerationSettingsForm({
  guildId,
  initial,
  channels,
  roles
}: {
  guildId: string;
  initial: GuildSettings;
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}) {
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
      <section className="card flex flex-col gap-3 p-5">
        <ToggleRow label="Moderation Commands" checked={form.moderationEnabled} onChange={(v) => set('moderationEnabled', v)} />
        <ToggleRow label="Anti-Spam Engine" checked={form.antiSpamEnabled} onChange={(v) => set('antiSpamEnabled', v)} />
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Spam Score Thresholds (0-100)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Warn Threshold">
            <TextInput type="number" min={0} max={100} value={form.spamWarnThreshold} onChange={(e) => set('spamWarnThreshold', Number(e.target.value))} />
          </Field>
          <Field label="Action Threshold (timeout)">
            <TextInput type="number" min={0} max={100} value={form.spamActionThreshold} onChange={(e) => set('spamActionThreshold', Number(e.target.value))} />
          </Field>
          <Field label="Ban Threshold">
            <TextInput type="number" min={0} max={100} value={form.spamBanThreshold} onChange={(e) => set('spamBanThreshold', Number(e.target.value))} />
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Whitelist</h2>
        <Field label="Whitelisted Roles">
          <MultiPillSelect options={roles} value={form.spamWhitelistRoleIds} onChange={(v) => set('spamWhitelistRoleIds', v)} />
        </Field>
        <Field label="Whitelisted Channels">
          <MultiPillSelect options={channels} value={form.spamWhitelistChanIds} onChange={(v) => set('spamWhitelistChanIds', v)} prefix="#" />
        </Field>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
