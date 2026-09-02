'use client';

import { useState } from 'react';
import type { ServerBackup } from '@prisma/client';
import { TextInput } from '../FormControls';

export function BackupManager({ guildId, initialBackups }: { guildId: string; initialBackups: ServerBackup[] }) {
  const [backups, setBackups] = useState(initialBackups);
  const [name, setName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function createBackup() {
    setCreating(true);
    const res = await fetch(`/api/guilds/${guildId}/backups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const backup = (await res.json()) as ServerBackup;
    setBackups((prev) => [backup, ...prev]);
    setName('');
    setCreating(false);
  }

  async function restore(id: string) {
    setBusyId(id);
    setStatus(null);
    const res = await fetch(`/api/guilds/${guildId}/backups/${id}`, { method: 'POST' });
    const result = (await res.json()) as { rolesCreated?: number; channelsCreated?: number; error?: string };
    setStatus(result.error ?? `Restored: ${result.rolesCreated} role(s), ${result.channelsCreated} channel(s) recreated.`);
    setBusyId(null);
  }

  async function remove(id: string) {
    await fetch(`/api/guilds/${guildId}/backups/${id}`, { method: 'DELETE' });
    setBackups((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-end gap-3 p-4">
        <TextInput placeholder="Backup name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <button className="btn-primary" disabled={creating} onClick={createBackup}>
          {creating ? 'Creating…' : '+ Create Backup'}
        </button>
      </div>

      {status && <div className="card p-3 text-sm text-white">{status}</div>}

      <div className="flex flex-col gap-2">
        {backups.length === 0 && <p className="text-sm text-discord-muted">No backups yet.</p>}
        {backups.map((b) => (
          <div key={b.id} className="card flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-white">{b.name}</div>
              <div className="text-xs text-discord-muted">{new Date(b.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-1.5 text-xs" disabled={busyId === b.id} onClick={() => restore(b.id)}>
                {busyId === b.id ? 'Restoring…' : 'Restore'}
              </button>
              <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => remove(b.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
