'use client';

import { useState } from 'react';
import { Field, TextInput, Select, MultiPillSelect } from '../FormControls';

interface RoleOption {
  label: string;
  emoji?: string;
  roleId: string;
}

interface Panel {
  id: string;
  title: string;
  style: string;
  options: RoleOption[];
}

export function ReactionRoleManager({ guildId, roles, initial }: { guildId: string; roles: { id: string; name: string }[]; initial: Panel[] }) {
  const [panels, setPanels] = useState(initial);
  const [title, setTitle] = useState('Choose your roles');
  const [style, setStyle] = useState('button');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  async function create() {
    if (selectedRoles.length === 0) return;
    setCreating(true);
    const options: RoleOption[] = selectedRoles.map((roleId) => ({ roleId, label: roles.find((r) => r.id === roleId)?.name ?? roleId }));
    const res = await fetch(`/api/guilds/${guildId}/reaction-roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, style, options })
    });
    const panel = await res.json();
    setPanels((p) => [...p, panel]);
    setSelectedRoles([]);
    setCreating(false);
  }

  async function remove(id: string) {
    setPanels((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/guilds/${guildId}/reaction-roles/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Self-Role Panels</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Panel Title">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Style">
            <Select value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="button">Buttons</option>
              <option value="dropdown">Dropdown</option>
            </Select>
          </Field>
        </div>
        <Field label="Roles to include">
          <MultiPillSelect options={roles} value={selectedRoles} onChange={setSelectedRoles} />
        </Field>
        <button className="btn-primary self-start" disabled={creating} onClick={create}>
          {creating ? 'Creating…' : 'Create Panel'}
        </button>
      </section>

      {panels.map((panel) => (
        <div key={panel.id} className="card flex items-center justify-between p-4">
          <div>
            <div className="font-semibold text-white">{panel.title}</div>
            <div className="text-xs text-discord-muted">
              {panel.style} · ID: <code>{panel.id}</code> · post with <code>/rolepanel id:{panel.id}</code>
            </div>
          </div>
          <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => remove(panel.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
