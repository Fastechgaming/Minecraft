'use client';

import { useState } from 'react';
import type { KnowledgeBase } from '@prisma/client';
import { Field, TextInput } from '../FormControls';

export function KnowledgeManager({ guildId, initialEntries }: { guildId: string; initialEntries: KnowledgeBase[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('general');
  const [creating, setCreating] = useState(false);

  async function addEntry() {
    if (!question.trim() || !answer.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/guilds/${guildId}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer, category })
    });
    const entry = (await res.json()) as KnowledgeBase;
    setEntries((prev) => [entry, ...prev]);
    setQuestion('');
    setAnswer('');
    setCreating(false);
  }

  async function removeEntry(id: string) {
    await fetch(`/api/guilds/${guildId}/knowledge/${id}`, { method: 'DELETE' });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Add Entry</h2>
        <Field label="Question">
          <TextInput value={question} onChange={(e) => setQuestion(e.target.value)} />
        </Field>
        <Field label="Answer">
          <textarea className="input min-h-[100px]" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </Field>
        <Field label="Category">
          <TextInput value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <button className="btn-primary self-start" disabled={creating || !question.trim() || !answer.trim()} onClick={addEntry}>
          {creating ? 'Adding…' : '+ Add Entry'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {entries.length === 0 && <p className="text-sm text-discord-muted">No knowledge entries yet.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="card flex items-start justify-between gap-4 p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-discord-muted">{entry.category}</div>
              <div className="mt-1 font-medium text-white">{entry.question}</div>
              <div className="mt-1 text-sm text-discord-muted">{entry.answer}</div>
            </div>
            <button className="btn-secondary shrink-0 px-2 py-1 text-xs" onClick={() => removeEntry(entry.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
