'use client';

import { useState } from 'react';
import type { TicketCategory } from '@prisma/client';
import { Field, TextInput, Select, SaveBar, Toggle } from '../FormControls';
import { EmbedPreview } from './EmbedPreview';
import {
  parsePanelEmbeds,
  parsePanelComponents,
  parseOpenerOverrides,
  OPENER_PERMISSION_KEYS,
  OPENER_PERMISSION_LABELS,
  MAX_PANEL_ROWS,
  MAX_BUTTONS_PER_ROW,
  type PanelEmbedData,
  type PanelComponentRow
} from '../../../tickets/panelTypes';

interface PanelForDesigner {
  id: string;
  content: string | null;
  embeds: unknown;
  components: unknown;
  openerPermissionOverrides: unknown;
}

const DEFAULT_EMBED: PanelEmbedData = { title: 'Support', description: 'Select an option below to open a ticket.', color: 0x22c55e };

export function PanelDesigner({ guildId, panel, initialOptions }: { guildId: string; panel: PanelForDesigner; initialOptions: TicketCategory[] }) {
  const [content, setContent] = useState(panel.content ?? '');
  const [showContent, setShowContent] = useState(!!panel.content);
  const [embeds, setEmbeds] = useState<PanelEmbedData[]>(() => {
    const parsed = parsePanelEmbeds(panel.embeds);
    return parsed.length > 0 ? parsed : [DEFAULT_EMBED];
  });
  const [rows, setRows] = useState<PanelComponentRow[]>(() => parsePanelComponents(panel.components));
  const [options, setOptions] = useState<TicketCategory[]>(initialOptions);
  const [openerOverrides, setOpenerOverrides] = useState(() => parseOpenerOverrides(panel.openerPermissionOverrides));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const byId = new Map(options.map((o) => [o.id, o]));

  function touch() {
    setDirty(true);
  }

  function updateEmbed(i: number, patch: Partial<PanelEmbedData>) {
    setEmbeds((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
    touch();
  }
  function addEmbed() {
    if (embeds.length >= 10) return;
    setEmbeds((prev) => [...prev, { title: '', description: '', color: 0x22c55e }]);
    touch();
  }
  function duplicateEmbed(i: number) {
    if (embeds.length >= 10) return;
    setEmbeds((prev) => [...prev.slice(0, i + 1), { ...prev[i] }, ...prev.slice(i + 1)]);
    touch();
  }
  function removeEmbed(i: number) {
    setEmbeds((prev) => prev.filter((_, idx) => idx !== i));
    touch();
  }

  function addRow(type: 'buttons' | 'select') {
    if (rows.length >= MAX_PANEL_ROWS) return;
    setRows((prev) => [...prev, type === 'buttons' ? { type, optionIds: [] } : { type, placeholder: 'Select an option...', optionIds: [] }]);
    touch();
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    touch();
  }
  function moveRow(i: number, dir: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    touch();
  }
  function updatePlaceholder(i: number, placeholder: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i && r.type === 'select' ? { ...r, placeholder } : r)));
    touch();
  }
  function removeOptionFromRow(i: number, optionId: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, optionIds: r.optionIds.filter((id) => id !== optionId) } : r)));
    touch();
  }
  async function addOptionToRow(i: number) {
    const row = rows[i];
    const cap = row.type === 'buttons' ? MAX_BUTTONS_PER_ROW : 25;
    if (row.optionIds.length >= cap) return;
    const res = await fetch(`/api/guilds/${guildId}/tickets/panels/${panel.id}/options`, { method: 'POST' });
    const option = (await res.json()) as TicketCategory;
    setOptions((prev) => [...prev, option]);
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, optionIds: [...r.optionIds, option.id] } : r)));
    touch();
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/guilds/${guildId}/tickets/panels/${panel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: showContent ? content : null,
        embeds,
        components: rows,
        openerPermissionOverrides: openerOverrides
      })
    });
    setSaving(false);
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Panel Designer</h1>
          <p className="text-discord-muted">Edit and customize your panel.</p>
        </div>
        <a href={`/dashboard/${guildId}/tickets/panels`} className="btn-secondary">
          ← All Panels
        </a>
      </div>

      <div className="card flex flex-col gap-4 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Panel Preview</h2>

        {!showContent && (
          <button className="btn-secondary self-start" onClick={() => setShowContent(true)}>
            + Add Text Content
          </button>
        )}
        {showContent && (
          <Field label="Text Content" hint="Optional plain text shown above the embed(s)">
            <TextInput
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                touch();
              }}
            />
          </Field>
        )}

        {embeds.map((embed, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-discord-border p-3">
            <div className="flex items-center justify-between text-xs text-discord-muted">
              <span>Embed {i + 1}</span>
              <div className="flex gap-3">
                <button className="hover:text-white" onClick={() => duplicateEmbed(i)}>
                  Duplicate embed
                </button>
                {embeds.length > 1 && (
                  <button className="text-discord-red hover:text-red-400" onClick={() => removeEmbed(i)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Title">
                <TextInput value={embed.title ?? ''} onChange={(e) => updateEmbed(i, { title: e.target.value })} maxLength={256} />
              </Field>
              <Field label="Color">
                <input
                  type="color"
                  className="input h-10 p-1"
                  value={`#${(embed.color ?? 0x22c55e).toString(16).padStart(6, '0')}`}
                  onChange={(e) => updateEmbed(i, { color: parseInt(e.target.value.slice(1), 16) })}
                />
              </Field>
              <Field label="Description" hint="Supports Discord markdown">
                <textarea
                  className="input min-h-24"
                  value={embed.description ?? ''}
                  onChange={(e) => updateEmbed(i, { description: e.target.value })}
                  maxLength={4096}
                />
              </Field>
              <Field label="Thumbnail URL">
                <TextInput value={embed.thumbnailUrl ?? ''} onChange={(e) => updateEmbed(i, { thumbnailUrl: e.target.value || undefined })} />
              </Field>
              <Field label="Footer Text">
                <TextInput value={embed.footerText ?? ''} onChange={(e) => updateEmbed(i, { footerText: e.target.value || undefined })} maxLength={2048} />
              </Field>
            </div>
            <div className="border-t border-discord-border pt-2">
              <EmbedPreview embed={embed} />
            </div>
          </div>
        ))}

        {embeds.length < 10 && (
          <button className="btn-secondary self-center" onClick={addEmbed}>
            + Add Embed
          </button>
        )}
      </div>

      <div className="card flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Interaction Area</h2>
          <span className="text-xs text-discord-muted">
            Rows available <strong className="text-white">[{rows.length}/{MAX_PANEL_ROWS}]</strong>
          </span>
        </div>

        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-discord-border p-3">
            <div className="flex items-center justify-between text-xs text-discord-muted">
              <span>{row.type === 'buttons' ? 'Button Row' : 'Dropdown Menu'}</span>
              <div className="flex items-center gap-2">
                <button className="hover:text-white disabled:opacity-30" disabled={i === 0} onClick={() => moveRow(i, -1)}>
                  ↑
                </button>
                <button className="hover:text-white disabled:opacity-30" disabled={i === rows.length - 1} onClick={() => moveRow(i, 1)}>
                  ↓
                </button>
                <button className="text-discord-red hover:text-red-400" onClick={() => removeRow(i)}>
                  Delete
                </button>
              </div>
            </div>

            {row.type === 'select' && (
              <TextInput value={row.placeholder} onChange={(e) => updatePlaceholder(i, e.target.value)} placeholder="Placeholder text" />
            )}

            <div className="flex flex-wrap gap-2">
              {row.optionIds.map((id) => {
                const option = byId.get(id);
                return (
                  <div key={id} className="flex items-center gap-1 rounded-lg bg-discord-panel2 pl-3 pr-1 py-1.5 text-sm">
                    <a href={`/dashboard/${guildId}/tickets/panels/${panel.id}/options/${id}`} className="text-white hover:underline">
                      {option ? `${option.emoji} ${option.name}` : '(missing option)'}
                    </a>
                    <button className="rounded px-1.5 text-discord-muted hover:bg-discord-border hover:text-white" onClick={() => removeOptionFromRow(i, id)}>
                      ×
                    </button>
                  </div>
                );
              })}
              <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => addOptionToRow(i)}>
                + Add Option
              </button>
            </div>
          </div>
        ))}

        {rows.length < MAX_PANEL_ROWS && (
          <div className="flex justify-center gap-3">
            <button className="btn-secondary" onClick={() => addRow('buttons')}>
              + Add Button Row
            </button>
            <button className="btn-secondary" onClick={() => addRow('select')}>
              + Add Dropdown Menu
            </button>
          </div>
        )}
      </div>

      <div className="card flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Default Ticket Opener Permissions</h2>
        <p className="text-xs text-discord-muted">Applies to every option on this panel, unless that option sets its own custom permissions.</p>
        {OPENER_PERMISSION_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-4 py-3">
            <span className="text-sm text-white">{OPENER_PERMISSION_LABELS[key]}</span>
            <Toggle
              checked={openerOverrides[key] !== false}
              onChange={(v) => {
                setOpenerOverrides((prev) => ({ ...prev, [key]: v }));
                touch();
              }}
            />
          </div>
        ))}
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
