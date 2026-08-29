'use client';

import { useState, type ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { Sidebar } from './Sidebar';

interface Props {
  guildId: string;
  guildName: string;
  role: string;
  userName: string;
  userAvatar: string | null;
  children: ReactNode;
}

export function DashboardShell({ guildId, guildName, role, userName, userAvatar, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-discord-dark">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-discord-border bg-discord-darker md:block">
        <Sidebar guildId={guildId} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-72 border-r border-discord-border bg-discord-darker">
            <Sidebar guildId={guildId} />
          </div>
          <button aria-label="Close menu" className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-discord-border bg-discord-darker px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-white hover:bg-discord-panel2 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              ☰
            </button>
            <div>
              <div className="text-sm font-semibold text-white">{guildName}</div>
              <div className="text-xs text-discord-muted">Signed in as {userName} · {role}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userAvatar && <img src={userAvatar} alt={userName} className="h-8 w-8 rounded-full" />}
            <button onClick={() => signOut({ callbackUrl: '/' })} className="btn-secondary px-3 py-1.5 text-xs">
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
