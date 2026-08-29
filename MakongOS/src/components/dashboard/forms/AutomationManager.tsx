'use client';

import { useState } from 'react';
import { Field, TextInput, Select, Toggle } from '../FormControls';

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  conditions: string;
  actions: string;
}

const TRIGGERS = ['member_join', 'member_leave', 'ai_high_confidence_spam', 'message_contains', 'role_added', 'command_used', 'scheduled'];

const EXAMPLE_ACTIONS = JSON.stringify([{ type: 'send_message', params: { content: 'Welcome {user}!' } }], null, 2);

export function AutomationManager({ guildId, initial }: { guildId: string; initial: Rule[] }) {
  const [rules, setRules] = useState(initial);
  const [draft, setDraft] = useState({ name: '', trigger: 'member_join', actions: EXAMPLE_ACTIONS, conditions: '[]' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setError('');
    if (!draft.name.trim()) return;
    let actions: unknown;
    let conditions: unknown;
    try {
      actions = JSON.parse(draft.actions);
      conditions = JSON.parse(draft.conditions);
    } catch {
      setError('Actions/Conditions must be valid JSON.');
      return;
    }
    setCreating(true);
    const res = await fetch(`/api/guilds/${guildId}/automation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: draft.name, trigger: draft.trigger, actions, conditions })
    });
    const rule = await res.json();
    setRules((r) => [
      { ...rule, conditions: JSON.stringify(rule.conditions, null, 2), actions: JSON.stringify(rule.actions, null, 2) },
      ...r
    ]);
    setDraft({ name: '', trigger: 'member_join', actions: EXAMPLE_ACTIONS, conditions: '[]' });
    setCreating(false);
  }

  async function toggle(id: string, enabled: boolean) {
    setRules((r) => r.map((x) => (x.id === id ? { ...x, enabled } : x)));
    await fetch(`/api/guilds/${guildId}/automation/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
  }

  async function remove(id: string) {
    setRules((r) => r.filter((x) => x.id !== id));
    await fetch(`/api/guilds/${guildId}/automation/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">New Rule</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name">
            <TextInput value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Welcome new members" />
          </Field>
          <Field label="Trigger (WHEN)">
            <Select value={draft.trigger} onChange={(e) => setDraft((d) => ({ ...d, trigger: e.target.value }))}>
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Conditions (IF)" hint='JSON array, e.g. [{"field":"score","operator":"equals","value":"high"}]'>
          <textarea className="input min-h-[70px] font-mono text-xs" value={draft.conditions} onChange={(e) => setDraft((d) => ({ ...d, conditions: e.target.value }))} />
        </Field>
        <Field
          label="Actions (THEN)"
          hint="JSON array of { type, params }. Types: send_message, add_role, remove_role, timeout, notify_staff"
        >
          <textarea className="input min-h-[100px] font-mono text-xs" value={draft.actions} onChange={(e) => setDraft((d) => ({ ...d, actions: e.target.value }))} />
        </Field>
        {error && <p className="text-sm text-discord-red">{error}</p>}
        <button className="btn-primary self-start" disabled={creating} onClick={create}>
          {creating ? 'Creating…' : 'Create Rule'}
        </button>
      </section>

      <div className="flex flex-col gap-2">
        {rules.length === 0 && <p className="text-discord-muted">No automation rules yet.</p>}
        {rules.map((rule) => (
          <div key={rule.id} className="card flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{rule.name}</span>
                <span className="pill bg-discord-panel2 text-discord-muted">{rule.trigger}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Toggle checked={rule.enabled} onChange={(v) => toggle(rule.id, v)} label={rule.name} />
              <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => remove(rule.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
