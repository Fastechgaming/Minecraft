'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function buildNav(guildId: string): NavGroup[] {
  const base = `/dashboard/${guildId}`;
  return [
    { title: '', items: [{ href: base, label: 'Overview', icon: '📊' }] },
    { title: 'Server', items: [{ href: `${base}/server`, label: 'General', icon: '⚙️' }] },
    {
      title: 'AI',
      items: [
        { href: `${base}/ai`, label: 'AI Staff', icon: '🤖' },
        { href: `${base}/ai/knowledge`, label: 'Knowledge', icon: '📚' }
      ]
    },
    { title: 'Economy', items: [{ href: `${base}/economy`, label: 'Settings', icon: '💰' }] },
    { title: 'Tickets', items: [{ href: `${base}/tickets`, label: 'Panels & Categories', icon: '🎫' }] },
    { title: 'Suggestions', items: [{ href: `${base}/suggestions`, label: 'Queue & Settings', icon: '📣' }] },
    { title: 'Giveaways', items: [{ href: `${base}/giveaways`, label: 'Active & History', icon: '🎉' }] },
    { title: 'Music', items: [{ href: `${base}/music`, label: 'Settings', icon: '🎵' }] },
    { title: 'Community', items: [{ href: `${base}/community`, label: 'XP & Leaderboard', icon: '📈' }] },
    { title: 'Commands', items: [{ href: `${base}/commands`, label: 'Command Manager', icon: '⌨️' }] },
    { title: 'Logs', items: [{ href: `${base}/logs`, label: 'Audit Logs', icon: '🧾' }] },
    { title: 'System', items: [{ href: `${base}/system`, label: 'Health & Providers', icon: '🩺' }] }
  ];
}

export function Sidebar({ guildId }: { guildId: string }) {
  const pathname = usePathname();
  const groups = buildNav(guildId);

  return (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <Link href="/dashboard" className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold text-discord-muted hover:text-white">
        ← All servers
      </Link>
      {groups.map((group) => (
        <div key={group.title || 'root'}>
          {group.title && <div className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-discord-muted">{group.title}</div>}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? 'bg-discord-blurple text-white' : 'text-discord-muted hover:bg-discord-panel2 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
