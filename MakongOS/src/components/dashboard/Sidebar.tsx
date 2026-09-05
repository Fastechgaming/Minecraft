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
    { title: 'Moderation', items: [{ href: `${base}/moderation`, label: 'Automod & Anti-Scam', icon: '🛡️' }] },
    { title: 'AI', items: [{ href: `${base}/ai`, label: 'AI Assistant', icon: '🤖' }, { href: `${base}/ai/knowledge`, label: 'Knowledge Base', icon: '📚' }] },
    { title: 'Leveling', items: [{ href: `${base}/leveling`, label: 'XP & Rewards', icon: '📈' }] },
    { title: 'Economy', items: [{ href: `${base}/economy`, label: 'Currency & Shop', icon: '💰' }] },
    { title: 'Music', items: [{ href: `${base}/music`, label: 'Playback Settings', icon: '🎵' }] },
    { title: 'Voice Hub', items: [{ href: `${base}/voicehub`, label: 'Join to Create', icon: '🔊' }] },
    { title: 'Giveaways', items: [{ href: `${base}/giveaways`, label: 'Active & History', icon: '🎉' }] },
    { title: 'Roles', items: [{ href: `${base}/reactionroles`, label: 'Reaction Roles', icon: '🎭' }] },
    { title: 'Community', items: [{ href: `${base}/community`, label: 'Welcome & Leave', icon: '👋' }] },
    { title: 'Social', items: [{ href: `${base}/social`, label: 'Live Alerts', icon: '📡' }] },
    { title: 'Backups', items: [{ href: `${base}/backups`, label: 'Server Backups', icon: '🗄️' }] },
    { title: 'Commands', items: [{ href: `${base}/commands`, label: 'Command Manager', icon: '⌨️' }] },
    { title: 'Logs', items: [{ href: `${base}/logs`, label: 'Audit Logs', icon: '🧾' }] },
    { title: 'Admin', items: [{ href: `${base}/admin`, label: 'System & Vouchers', icon: '🩺' }] }
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
