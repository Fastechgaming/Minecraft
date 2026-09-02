'use client';

import { useState } from 'react';
import { Toggle } from '../FormControls';

interface CommandRow {
  name: string;
  description: string;
  module: string;
  enabled: boolean;
}

export function CommandManagerTable({ guildId, initialCommands }: { guildId: string; initialCommands: CommandRow[] }) {
  const [commands, setCommands] = useState(initialCommands);

  async function toggle(name: string, enabled: boolean) {
    setCommands((prev) => prev.map((c) => (c.name === name ? { ...c, enabled } : c)));
    await fetch(`/api/guilds/${guildId}/commands/${name}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
  }

  const byModule = commands.reduce<Record<string, CommandRow[]>>((acc, c) => {
    (acc[c.module] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(byModule).map(([mod, cmds]) => (
        <div key={mod} className="card flex flex-col gap-2 p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-discord-muted">{mod}</h2>
          {cmds.map((c) => (
            <div key={c.name} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-white">/{c.name}</div>
                <div className="text-xs text-discord-muted">{c.description}</div>
              </div>
              <Toggle checked={c.enabled} onChange={(v) => toggle(c.name, v)} label={c.name} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
