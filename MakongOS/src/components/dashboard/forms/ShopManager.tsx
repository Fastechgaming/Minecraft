'use client';

import { useState } from 'react';
import type { ShopItem } from '@prisma/client';
import { Field, TextInput, Select } from '../FormControls';

export function ShopManager({ guildId, initialItems, roles }: { guildId: string; initialItems: ShopItem[]; roles: { id: string; name: string }[] }) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(100);
  const [roleId, setRoleId] = useState('');
  const [emoji, setEmoji] = useState('📦');
  const [creating, setCreating] = useState(false);

  async function addItem() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/guilds/${guildId}/shop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price, roleId: roleId || undefined, emoji })
    });
    const item = (await res.json()) as ShopItem;
    setItems((prev) => [...prev, item]);
    setName('');
    setPrice(100);
    setCreating(false);
  }

  async function removeItem(id: string) {
    await fetch(`/api/guilds/${guildId}/shop/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="card flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Shop Items</h2>

      <div className="flex flex-col gap-2">
        {items.length === 0 && <p className="text-sm text-discord-muted">No items yet — add one below.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm">
            <span className="text-white">
              {item.emoji} <strong>{item.name}</strong> — {item.price.toLocaleString()} {item.roleId ? `(grants role)` : ''}
            </span>
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => removeItem(item.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-discord-border pt-4 md:grid-cols-4">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Price">
          <TextInput type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
        <Field label="Emoji">
          <TextInput value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
        </Field>
        <Field label="Grants Role (optional)">
          <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">None</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <button className="btn-primary self-start" disabled={creating || !name.trim()} onClick={addItem}>
        {creating ? 'Adding…' : '+ Add Item'}
      </button>
    </div>
  );
}
