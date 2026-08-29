'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { WelcomeConfig } from '@prisma/client';
import { Field, TextInput, ToggleRow, SaveBar } from '../FormControls';

function applySample(template: string): string {
  return template
    .replace(/\{user\}/g, '@Steve')
    .replace(/\{username\}/g, 'Steve')
    .replace(/\{server\}/g, 'Makong Network')
    .replace(/\{member_count\}/g, '8,421');
}

export function WelcomeForm({ guildId, initial }: { guildId: string; initial: WelcomeConfig }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof WelcomeConfig>(key: K, value: WelcomeConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/guilds/${guildId}/welcome`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setSaving(false);
    setDirty(false);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6 pb-6">
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Welcome Embed</h2>
          <Field label="Title" hint="Placeholders: {user} {username} {server} {member_count}">
            <TextInput value={form.embedTitle} onChange={(e) => set('embedTitle', e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea className="input min-h-[80px]" value={form.embedDescription} onChange={(e) => set('embedDescription', e.target.value)} />
          </Field>
          <Field label="Image URL">
            <TextInput value={form.embedImage ?? ''} onChange={(e) => set('embedImage', e.target.value || null)} placeholder="https://..." />
          </Field>
          <Field label="Color">
            <input type="color" value={form.embedColor} onChange={(e) => set('embedColor', e.target.value)} className="h-10 w-full rounded-lg border border-discord-border bg-discord-darker" />
          </Field>
          <ToggleRow label="Also DM the member" checked={form.dmEnabled} onChange={(v) => set('dmEnabled', v)} />
        </section>

        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Leave Message</h2>
          <ToggleRow label="Leave Messages Enabled" checked={form.leaveEnabled} onChange={(v) => set('leaveEnabled', v)} />
          <Field label="Message" hint="Placeholders: {username} {member_count}">
            <textarea className="input min-h-[60px]" value={form.leaveMessage} onChange={(e) => set('leaveMessage', e.target.value)} />
          </Field>
        </section>

        <SaveBar dirty={dirty} saving={saving} onSave={save} />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Live Preview</h2>
        <div className="card overflow-hidden p-4" style={{ borderLeftColor: form.embedColor, borderLeftWidth: 4 }}>
          <div className="text-sm font-semibold text-white">{applySample(form.embedTitle)}</div>
          <div className="mt-1 whitespace-pre-wrap text-sm text-discord-muted">{applySample(form.embedDescription)}</div>
          {form.embedImage && <img src={form.embedImage} alt="" className="mt-3 max-h-48 w-full rounded-lg object-cover" />}
        </div>
        {form.leaveEnabled && (
          <div className="card p-4 text-sm text-discord-muted">{applySample(form.leaveMessage)}</div>
        )}
      </div>
    </div>
  );
}
