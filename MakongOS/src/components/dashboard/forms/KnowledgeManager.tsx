'use client';

import { useState } from 'react';
import { Field, TextInput, Select } from '../FormControls';

interface Entry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
}

const CATEGORIES = ['rules', 'faq', 'minecraft', 'commands', 'ranks', 'store', 'events', 'staff', 'punishments', 'other'];

export function KnowledgeManager({ guildId, initial }: { guildId: string; initial: Entry[] }) {
  const [entries, setEntries] = useState(initial);
  const [draft, setDraft] = useState({ category: 'faq', title: '', content: '', keywords: '' });
  const [creating, setCreating] = useState(false);

  async function createEntry() {
    if (!draft.title.trim() || !draft.content.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/guilds/${guildId}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: draft.category,
        title: draft.title,
        content: draft.content,
        keywords: draft.keywords.split(',').map((k) => k.trim()).filter(Boolean)
      })
    });
    const entry = await res.json();
    setEntries((e) => [...e, entry]);
    setDraft({ category: 'faq', title: '', content: '', keywords: '' });
    setCreating(false);
  }

  async function deleteEntry(id: string) {
    setEntries((e) => e.filter((x) => x.id !== id));
    await fetch(`/api/guilds/${guildId}/knowledge/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Add Knowledge</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title">
            <TextInput value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="PvP Rules" />
          </Field>
        </div>
        <Field label="Content">
          <textarea
            className="input min-h-[100px]"
            value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            placeholder="PvP is optional in the overworld, but mandatory in the Wilderness zone..."
          />
        </Field>
        <Field label="Keywords" hint="Comma separated — boosts matching for these terms">
          <TextInput value={draft.keywords} onChange={(e) => setDraft((d) => ({ ...d, keywords: e.target.value }))} placeholder="pvp, combat, wilderness" />
        </Field>
        <button className="btn-primary self-start" disabled={creating} onClick={createEntry}>
          {creating ? 'Adding…' : 'Add Entry'}
        </button>
      </section>

      <div className="flex flex-col gap-3">
        {entries.length === 0 && <p className="text-discord-muted">No knowledge entries yet — add your first one above.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="card flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="pill bg-discord-blurple/20 text-discord-blurple">{entry.category}</span>
                <span className="font-semibold text-white">{entry.title}</span>
              </div>
              <p className="mt-1 text-sm text-discord-muted">{entry.content}</p>
              {entry.keywords.length > 0 && <p className="mt-1 text-xs text-discord-muted">Keywords: {entry.keywords.join(', ')}</p>}
            </div>
            <button className="btn-danger shrink-0 px-3 py-1.5 text-xs" onClick={() => deleteEntry(entry.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
