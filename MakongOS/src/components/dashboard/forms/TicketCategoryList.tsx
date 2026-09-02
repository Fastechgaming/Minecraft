'use client';

import { useState } from 'react';
import type { TicketCategory } from '@prisma/client';

export function TicketCategoryList({ guildId, initialCategories }: { guildId: string; initialCategories: TicketCategory[] }) {
  const [categories, setCategories] = useState(initialCategories);

  async function remove(id: string) {
    await fetch(`/api/guilds/${guildId}/tickets/categories/${id}`, { method: 'DELETE' });
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Ticket Categories</h2>
      {categories.length === 0 && <p className="text-sm text-discord-muted">None yet — create one with `/ticketcat add`.</p>}
      {categories.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm">
          <span className="text-white">
            {c.emoji} <strong>{c.name}</strong>
          </span>
          <button className="btn-secondary px-2 py-1 text-xs" onClick={() => remove(c.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
