'use client';

import { useState } from 'react';
import type { PremiumVoucher } from '@prisma/client';

export function VoucherManager({ initialVouchers }: { initialVouchers: PremiumVoucher[] }) {
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [creating, setCreating] = useState(false);

  async function createVoucher() {
    setCreating(true);
    const res = await fetch('/api/admin/vouchers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'premium' }) });
    const voucher = (await res.json()) as PremiumVoucher;
    setVouchers((prev) => [voucher, ...prev]);
    setCreating(false);
  }

  async function remove(id: string) {
    await fetch(`/api/admin/vouchers/${id}`, { method: 'DELETE' });
    setVouchers((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-muted">Premium Vouchers</h2>
        <button className="btn-primary px-3 py-1.5 text-xs" disabled={creating} onClick={createVoucher}>
          {creating ? 'Generating…' : '+ Generate Code'}
        </button>
      </div>
      {vouchers.length === 0 && <p className="text-sm text-discord-muted">No vouchers yet.</p>}
      {vouchers.map((v) => (
        <div key={v.id} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm">
          <span className="font-mono text-white">{v.code}</span>
          <span className="text-xs text-discord-muted">{v.redeemedByGuildId ? `Redeemed by ${v.redeemedByGuildId}` : 'Unredeemed'}</span>
          <button className="btn-secondary px-2 py-1 text-xs" onClick={() => remove(v.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
