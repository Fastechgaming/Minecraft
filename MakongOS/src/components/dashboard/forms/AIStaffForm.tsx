'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GuildSettings } from '@prisma/client';
import { Field, TextInput, Select, ToggleRow, MultiPillSelect, SaveBar } from '../FormControls';

export function AIStaffForm({ guildId, initial, channels }: { guildId: string; initial: GuildSettings; channels: { id: string; name: string }[] }) {
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Behavior</h2>
        <ToggleRow label="AI Staff Assistant Enabled" checked={form.aiEnabled} onChange={(v) => set('aiEnabled', v)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mode">
            <Select value={form.aiMode} onChange={(e) => set('aiMode', e.target.value)}>
              <option value="staff">Staff — helpful & friendly</option>
              <option value="friend">Friend — casual & playful</option>
              <option value="hybrid">Hybrid — blend of staff + friend</option>
            </Select>
          </Field>
          <Field label="Response Frequency">
            <Select value={form.aiResponseFrequency} onChange={(e) => set('aiResponseFrequency', e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </Field>
        </div>
        <Field label="AI Channels" hint="Leave empty to allow the AI to respond anywhere">
          <MultiPillSelect options={channels} value={form.aiChannelIds} onChange={(v) => set('aiChannelIds', v)} prefix="#" />
        </Field>
        <ToggleRow label="Require Mention" description="Only respond when @mentioned or replied to" checked={form.aiMentionRequired} onChange={(v) => set('aiMentionRequired', v)} />
        <ToggleRow label="Help Detection" description="Recognize questions and help requests automatically" checked={form.aiHelpDetection} onChange={(v) => set('aiHelpDetection', v)} />
        <ToggleRow label="Casual Conversation" description="Allow the AI to join in on regular chat" checked={form.aiCasualConversation} onChange={(v) => set('aiCasualConversation', v)} />
        <ToggleRow label="Staff Escalation" description="Open a ticket / alert staff when the AI can't confidently help" checked={form.aiStaffEscalation} onChange={(v) => set('aiStaffEscalation', v)} />
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Memory</h2>
        <ToggleRow label="Memory Enabled" checked={form.aiMemoryEnabled} onChange={(v) => set('aiMemoryEnabled', v)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Memory Duration (hours)">
            <TextInput type="number" min={0} value={form.aiMemoryDurationHours} onChange={(e) => set('aiMemoryDurationHours', Number(e.target.value))} />
          </Field>
          <Field label="Max Conversation History (messages)">
            <TextInput type="number" min={1} value={form.aiMaxHistoryMessages} onChange={(e) => set('aiMaxHistoryMessages', Number(e.target.value))} />
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Vision & Image Generation</h2>
        <ToggleRow label="Image Understanding" description="Let the AI analyze screenshots users send" checked={form.aiImageUnderstanding} onChange={(v) => set('aiImageUnderstanding', v)} />
        <ToggleRow label="Image Generation" description="Enable /ai image" checked={form.aiImageGeneration} onChange={(v) => set('aiImageGeneration', v)} />
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Cost Control</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Daily Limit">
            <TextInput type="number" min={0} value={form.aiDailyLimit} onChange={(e) => set('aiDailyLimit', Number(e.target.value))} />
          </Field>
          <Field label="Monthly Limit">
            <TextInput type="number" min={0} value={form.aiMonthlyLimit} onChange={(e) => set('aiMonthlyLimit', Number(e.target.value))} />
          </Field>
          <Field label="Per-User Cooldown (s)">
            <TextInput type="number" min={0} value={form.aiPerUserCooldownSec} onChange={(e) => set('aiPerUserCooldownSec', Number(e.target.value))} />
          </Field>
          <Field label="Per-Channel Cooldown (s)">
            <TextInput type="number" min={0} value={form.aiPerChannelCooldownSec} onChange={(e) => set('aiPerChannelCooldownSec', Number(e.target.value))} />
          </Field>
        </div>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
