'use client';

import { useState } from 'react';

interface Suggestion {
  id: string;
  userId: string;
  content: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

export function SuggestionQueue({ guildId, initial }: { guildId: string; initial: Suggestion[] }) {
  const [suggestions, setSuggestions] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function review(id: string, status: 'approved' | 'rejected') {
    setBusy(id);
    await fetch(`/api/guilds/${guildId}/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    setSuggestions((s) => s.filter((x) => x.id !== id));
    setBusy(null);
  }

  if (suggestions.length === 0) {
    return <p className="text-discord-muted">No pending suggestions — nice and caught up.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((s) => (
        <div key={s.id} className="card flex items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-sm text-white">{s.content}</p>
            <p className="mt-1 text-xs text-discord-muted">
              <span className="font-mono">{s.userId}</span> · 👍 {s.upvotes} · 👎 {s.downvotes} · {new Date(s.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="btn-primary px-3 py-1.5 text-xs" disabled={busy === s.id} onClick={() => review(s.id, 'approved')}>
              Approve
            </button>
            <button className="btn-danger px-3 py-1.5 text-xs" disabled={busy === s.id} onClick={() => review(s.id, 'rejected')}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
