'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { Field, TextInput, Select } from '../FormControls';

interface Current {
  type?: string;
  userId?: string;
  moderatorId?: string;
  channelId?: string;
}

export function LogFilters({ types, current }: { types: string[]; current: Current }) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState(current);

  function apply() {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }
    router.push(`${pathname}?${query.toString()}`);
  }

  return (
    <div className="card grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Type">
        <Select value={filters.type ?? ''} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">All</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="User ID">
        <TextInput value={filters.userId ?? ''} onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))} placeholder="123456789" />
      </Field>
      <Field label="Moderator ID">
        <TextInput value={filters.moderatorId ?? ''} onChange={(e) => setFilters((f) => ({ ...f, moderatorId: e.target.value }))} />
      </Field>
      <Field label="Channel ID">
        <TextInput value={filters.channelId ?? ''} onChange={(e) => setFilters((f) => ({ ...f, channelId: e.target.value }))} />
      </Field>
      <div className="flex items-end">
        <button className="btn-primary w-full" onClick={apply}>
          Apply Filters
        </button>
      </div>
    </div>
  );
}
