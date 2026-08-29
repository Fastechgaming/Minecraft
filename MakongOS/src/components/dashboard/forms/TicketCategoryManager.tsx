'use client';

import { useState } from 'react';
import { Field, TextInput } from '../FormControls';

interface Category {
  id: string;
  label: string;
  emoji: string | null;
  description: string | null;
}

export function TicketCategoryManager({ guildId, panelTitle, categories }: { guildId: string; panelTitle: string; categories: Category[] }) {
  const [cats, setCats] = useState(categories);
  const [draft, setDraft] = useState({ label: '', emoji: '', description: '' });
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!draft.label.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/guilds/${guildId}/tickets/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    const category = await res.json();
    setCats((c) => [...c, category]);
    setDraft({ label: '', emoji: '', description: '' });
    setCreating(false);
  }

  async function remove(id: string) {
    setCats((c) => c.filter((x) => x.id !== id));
    await fetch(`/api/guilds/${guildId}/tickets/categories/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Panel Preview — {panelTitle}</h2>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <span key={c.id} className="pill bg-discord-panel2 text-white">
              {c.emoji ?? '•'} {c.label}
            </span>
          ))}
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Add Category</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Label">
            <TextInput value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Bug Report" />
          </Field>
          <Field label="Emoji">
            <TextInput value={draft.emoji} onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))} placeholder="🐛" />
          </Field>
          <Field label="Description">
            <TextInput value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Report a bug" />
          </Field>
        </div>
        <button className="btn-primary self-start" disabled={creating} onClick={create}>
          {creating ? 'Adding…' : 'Add Category'}
        </button>
      </section>

      <div className="flex flex-col gap-2">
        {cats.map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-4">
            <div>
              <span className="font-semibold text-white">
                {c.emoji ?? '•'} {c.label}
              </span>
              {c.description && <p className="text-xs text-discord-muted">{c.description}</p>}
            </div>
            <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => remove(c.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
