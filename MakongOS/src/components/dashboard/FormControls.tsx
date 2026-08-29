'use client';

import type { ReactNode } from 'react';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-discord-muted">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ''}`} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-discord-blurple' : 'bg-discord-border'}`}
      aria-pressed={checked}
      aria-label={label}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-discord-panel2 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        {description && <div className="text-xs text-discord-muted">{description}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function MultiPillSelect({
  options,
  value,
  onChange,
  emptyLabel = 'None found — is the bot online?',
  prefix = ''
}: {
  options: { id: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  emptyLabel?: string;
  prefix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-discord-border bg-discord-darker p-2">
      {options.length === 0 && <span className="text-xs text-discord-muted">{emptyLabel}</span>}
      {options.map((option) => {
        const active = value.includes(option.id);
        return (
          <button
            type="button"
            key={option.id}
            onClick={() => onChange(active ? value.filter((v) => v !== option.id) : [...value, option.id])}
            className={`pill border ${active ? 'border-discord-blurple bg-discord-blurple/20 text-white' : 'border-discord-border text-discord-muted hover:text-white'}`}
          >
            {prefix}
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

export function MultiRoleSelect({ roles, value, onChange }: { roles: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return <MultiPillSelect options={roles} value={value} onChange={onChange} emptyLabel="No roles found — is the bot online?" />;
}

export function SaveBar({ dirty, saving, onSave, savedLabel = 'Saved' }: { dirty: boolean; saving: boolean; onSave: () => void; savedLabel?: string }) {
  return (
    <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-discord-border bg-discord-dark/95 px-1 py-3 backdrop-blur">
      {!dirty && !saving && <span className="text-xs text-discord-muted">{savedLabel}</span>}
      <button className="btn-primary" disabled={!dirty || saving} onClick={onSave}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
