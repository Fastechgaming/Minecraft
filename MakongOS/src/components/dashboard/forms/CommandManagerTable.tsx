'use client';

import { useState } from 'react';
import { Toggle, TextInput, MultiPillSelect } from '../FormControls';

interface Row {
  name: string;
  description: string;
  module: string;
  enabled: boolean;
  cooldownSec: number;
  allowedRoleIds: string[];
  disabledChannelIds: string[];
}

function CommandRow({
  guildId,
  row,
  channels,
  roles
}: {
  guildId: string;
  row: Row;
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}) {
  const [state, setState] = useState(row);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(patch: Partial<Row>) {
    const next = { ...state, ...patch };
    setState(next);
    setSaving(true);
    await fetch(`/api/guilds/${guildId}/commands/${row.name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
    setSaving(false);
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm font-semibold text-white">/{row.name}</code>
            <span className="pill bg-discord-panel2 text-discord-muted">{row.module}</span>
            {saving && <span className="text-xs text-discord-muted">saving…</span>}
          </div>
          <p className="truncate text-xs text-discord-muted">{row.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button className="text-xs text-discord-blurple hover:underline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide options' : 'Configure'}
          </button>
          <Toggle checked={state.enabled} onChange={(v) => save({ enabled: v })} label={`Toggle ${row.name}`} />
        </div>
      </div>

      {expanded && (
        <div className="mt-4 flex flex-col gap-4 border-t border-discord-border pt-4">
          <div className="max-w-xs">
            <label className="label">Cooldown (seconds)</label>
            <TextInput
              type="number"
              min={0}
              value={state.cooldownSec}
              onChange={(e) => save({ cooldownSec: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Allowed Roles (empty = everyone)</label>
            <MultiPillSelect options={roles} value={state.allowedRoleIds} onChange={(v) => save({ allowedRoleIds: v })} />
          </div>
          <div>
            <label className="label">Disabled Channels</label>
            <MultiPillSelect options={channels} value={state.disabledChannelIds} onChange={(v) => save({ disabledChannelIds: v })} prefix="#" />
          </div>
        </div>
      )}
    </div>
  );
}

export function CommandManagerTable({
  guildId,
  rows,
  channels,
  roles
}: {
  guildId: string;
  rows: Row[];
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}) {
  const modules = [...new Set(rows.map((r) => r.module))];

  return (
    <div className="flex flex-col gap-6">
      {modules.map((mod) => (
        <div key={mod} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">{mod}</h2>
          {rows
            .filter((r) => r.module === mod)
            .map((row) => (
              <CommandRow key={row.name} guildId={guildId} row={row} channels={channels} roles={roles} />
            ))}
        </div>
      ))}
    </div>
  );
}
