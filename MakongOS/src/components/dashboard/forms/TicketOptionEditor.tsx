'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TicketCategory } from '@prisma/client';
import { Field, TextInput, Select, SaveBar, Toggle, MultiRoleSelect, MultiPillSelect } from '../FormControls';
import { parseQuestions, parseOpenerOverrides, OPENER_PERMISSION_KEYS, OPENER_PERMISSION_LABELS, type TicketQuestion } from '../../../tickets/panelTypes';

type Tab = 'general' | 'messages' | 'advanced';

function newQuestion(): TicketQuestion {
  return { id: crypto.randomUUID(), label: '', type: 'short', required: true, active: true };
}

export function TicketOptionEditor({
  guildId,
  panelId,
  option,
  roles,
  discordCategories
}: {
  guildId: string;
  panelId: string;
  option: TicketCategory;
  roles: { id: string; name: string }[];
  discordCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('general');
  const [name, setName] = useState(option.name);
  const [emoji, setEmoji] = useState(option.emoji);
  const [description, setDescription] = useState(option.description);
  const [questions, setQuestions] = useState<TicketQuestion[]>(() => parseQuestions(option.formFields));
  const [requiredRoleIds, setRequiredRoleIds] = useState(option.requiredRoleIds);
  const [blockedRoleIds, setBlockedRoleIds] = useState(option.blockedRoleIds);
  const [customEmbedContent, setCustomEmbedContent] = useState(option.customEmbedContent ?? '');
  const [customTicketMessage, setCustomTicketMessage] = useState(option.customTicketMessage ?? '');
  const [staffRoleIds, setStaffRoleIds] = useState(option.staffRoleIds);
  const [categoryChannelId, setCategoryChannelId] = useState(option.categoryChannelId ?? '');
  const [overflowCategoryIds, setOverflowCategoryIds] = useState(option.overflowCategoryIds);
  const [nameFormat, setNameFormat] = useState(option.nameFormat ?? '');
  const [useTicketRolesAsPing, setUseTicketRolesAsPing] = useState(option.useTicketRolesAsPing);
  const [customPingRoleIds, setCustomPingRoleIds] = useState(option.customPingRoleIds);
  const [openerPermissionMode, setOpenerPermissionMode] = useState(option.openerPermissionMode as 'panelDefault' | 'custom');
  const [openerOverrides, setOpenerOverrides] = useState(() => parseOpenerOverrides(option.openerPermissionOverrides));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function touch<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  function addQuestion() {
    if (questions.length >= 5) return;
    setQuestions((prev) => [...prev, newQuestion()]);
    setDirty(true);
  }
  function updateQuestion(i: number, patch: Partial<TicketQuestion>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
    setDirty(true);
  }
  function removeQuestion(i: number) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/guilds/${guildId}/tickets/categories/${option.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        emoji,
        description,
        formFields: questions,
        requiredRoleIds,
        blockedRoleIds,
        customEmbedContent: customEmbedContent || null,
        customTicketMessage: customTicketMessage || null,
        staffRoleIds,
        categoryChannelId: categoryChannelId || null,
        overflowCategoryIds,
        nameFormat: nameFormat || null,
        useTicketRolesAsPing,
        customPingRoleIds,
        openerPermissionMode,
        openerPermissionOverrides: openerOverrides
      })
    });
    setSaving(false);
    setDirty(false);
  }

  async function reset() {
    if (!confirm('Discard unsaved changes on this option?')) return;
    router.refresh();
    setDirty(false);
  }

  async function remove() {
    if (!confirm(`Delete "${name}"? This also removes it from any panel row.`)) return;
    setDeleting(true);
    await fetch(`/api/guilds/${guildId}/tickets/categories/${option.id}`, { method: 'DELETE' });
    router.push(`/dashboard/${guildId}/tickets/panels/${panelId}`);
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          Edit: {emoji} {name}
        </h1>
        <a href={`/dashboard/${guildId}/tickets/panels/${panelId}`} className="btn-secondary">
          ← Back
        </a>
      </div>

      <div className="flex gap-2 border-b border-discord-border">
        {(['general', 'messages', 'advanced'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-discord-blurple text-white' : 'text-discord-muted hover:text-white'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="flex flex-col gap-6">
          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Actions</h2>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={reset}>
                ↺ Reset
              </button>
              <button className="btn-danger" disabled={deleting} onClick={remove}>
                🗑 Delete
              </button>
            </div>
          </div>

          <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
            <Field label="Emoji">
              <TextInput value={emoji} onChange={(e) => touch(setEmoji)(e.target.value)} maxLength={8} />
            </Field>
            <Field label="Option Text" hint="The clickable label on this option">
              <TextInput value={name} onChange={(e) => touch(setName)(e.target.value)} maxLength={80} />
            </Field>
            <Field label="Description" hint="Shown under the option in a dropdown menu">
              <TextInput value={description} onChange={(e) => touch(setDescription)(e.target.value)} maxLength={100} />
            </Field>
          </div>

          <div className="card flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Ticket Questions</h2>
              {questions.length < 5 && (
                <button className="btn-secondary px-3 py-1 text-xs" onClick={addQuestion}>
                  + Add Question
                </button>
              )}
            </div>
            {questions.length === 0 && <p className="text-sm text-discord-muted">No questions — opening this ticket skips straight to channel creation.</p>}
            {questions.map((q, i) => (
              <div key={q.id} className="flex flex-col gap-2 rounded-lg border border-discord-border p-3">
                <div className="flex items-center justify-between text-xs text-discord-muted">
                  <span>Question {i + 1}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(i, { required: e.target.checked })} /> Required
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={q.active} onChange={(e) => updateQuestion(i, { active: e.target.checked })} /> Active
                    </label>
                    <button className="text-discord-red hover:text-red-400" onClick={() => removeQuestion(i)}>
                      Delete
                    </button>
                  </div>
                </div>
                <TextInput value={q.label} onChange={(e) => updateQuestion(i, { label: e.target.value })} placeholder="Question label" maxLength={45} />
                <TextInput
                  value={q.helperText ?? ''}
                  onChange={(e) => updateQuestion(i, { helperText: e.target.value || undefined })}
                  placeholder="Helper text shown under the field (optional)..."
                  maxLength={100}
                />
                <div className="flex items-center gap-3">
                  <Select value={q.type} onChange={(e) => updateQuestion(i, { type: e.target.value as 'short' | 'paragraph' })} className="w-auto">
                    <option value="short">Short Answer</option>
                    <option value="paragraph">Paragraph</option>
                  </Select>
                  <span className="text-xs text-discord-muted">Character limit</span>
                  <TextInput
                    type="number"
                    className="w-20"
                    value={q.minLength ?? 0}
                    onChange={(e) => updateQuestion(i, { minLength: Number(e.target.value) })}
                  />
                  <span className="text-xs text-discord-muted">to</span>
                  <TextInput
                    type="number"
                    className="w-20"
                    value={q.maxLength ?? 500}
                    onChange={(e) => updateQuestion(i, { maxLength: Number(e.target.value) })}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Required Roles</h2>
            <p className="text-xs text-discord-muted">Roles that users must have to use this ticket option. Leave empty to allow everyone.</p>
            <MultiRoleSelect roles={roles} value={requiredRoleIds} onChange={touch(setRequiredRoleIds)} />
          </div>

          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Blocked Roles</h2>
            <p className="text-xs text-discord-muted">Users with any of these roles are blocked from this option. Server-wide blocked roles also apply.</p>
            <MultiRoleSelect roles={roles} value={blockedRoleIds} onChange={touch(setBlockedRoleIds)} />
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div className="flex flex-col gap-6">
          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Custom Embed Content</h2>
            <p className="text-xs text-discord-muted">Shown in the ticket channel's opening embed. Leave blank for the default message.</p>
            <textarea className="input min-h-32" value={customEmbedContent} onChange={(e) => touch(setCustomEmbedContent)(e.target.value)} maxLength={2048} />
          </div>
          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Custom Ticket Message</h2>
            <p className="text-xs text-discord-muted">Extra plain text sent alongside the embed (e.g. links, instructions).</p>
            <textarea className="input min-h-24" value={customTicketMessage} onChange={(e) => touch(setCustomTicketMessage)(e.target.value)} maxLength={1024} />
          </div>
        </div>
      )}

      {tab === 'advanced' && (
        <div className="flex flex-col gap-6">
          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Support Roles</h2>
            <p className="text-xs text-discord-muted">Roles that can view and manage tickets for this option. Server-wide support roles always apply too.</p>
            <MultiRoleSelect roles={roles} value={staffRoleIds} onChange={touch(setStaffRoleIds)} />
          </div>

          <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            <Field label="Category" hint="Discord category tickets are created under">
              <Select value={categoryChannelId} onChange={(e) => touch(setCategoryChannelId)(e.target.value)}>
                <option value="">None (top level)</option>
                {discordCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Overflow Categories" hint="Tried in order once the primary category fills up (50 channels)">
              <MultiPillSelect options={discordCategories} value={overflowCategoryIds} onChange={touch(setOverflowCategoryIds)} emptyLabel="No categories found" />
            </Field>
          </div>

          <div className="card flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Ticket Name Format</h2>
            <TextInput value={nameFormat} onChange={(e) => touch(setNameFormat)(e.target.value)} placeholder="ticket-{TICKET_NUMBER}" />
            <p className="text-xs text-discord-muted">Variables: {'{TICKET_NUMBER}'}, {'{USERNAME}'}</p>
          </div>

          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Custom Pings</h2>
            <div className="flex items-center justify-between rounded-lg bg-discord-panel2 px-4 py-3">
              <span className="text-sm text-white">Use support roles as ping roles</span>
              <Toggle checked={useTicketRolesAsPing} onChange={touch(setUseTicketRolesAsPing)} />
            </div>
            {!useTicketRolesAsPing && <MultiRoleSelect roles={roles} value={customPingRoleIds} onChange={touch(setCustomPingRoleIds)} />}
          </div>

          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Ticket Opener Permissions</h2>
            <Select value={openerPermissionMode} onChange={(e) => touch(setOpenerPermissionMode)(e.target.value as 'panelDefault' | 'custom')}>
              <option value="panelDefault">Use panel default</option>
              <option value="custom">Custom</option>
            </Select>
            {openerPermissionMode === 'custom' &&
              OPENER_PERMISSION_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-4 py-3">
                  <span className="text-sm text-white">{OPENER_PERMISSION_LABELS[key]}</span>
                  <Toggle checked={openerOverrides[key] !== false} onChange={(v) => touch(setOpenerOverrides)({ ...openerOverrides, [key]: v })} />
                </div>
              ))}
          </div>
        </div>
      )}

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
