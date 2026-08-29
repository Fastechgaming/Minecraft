import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { authOptions } from '../../lib/auth';
import { getManagedGuilds } from '../../lib/guildAccess';

export default async function GuildPickerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.userId) redirect('/');

  const guilds = await getManagedGuilds(session.accessToken, session.userId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="mb-2 text-2xl font-bold text-white">Select a server</h1>
      <p className="mb-8 text-discord-muted">Choose which Discord server you want to manage.</p>

      {guilds.length === 0 ? (
        <div className="card p-8 text-center text-discord-muted">
          You don&apos;t manage any servers with MakongOS installed. Invite the bot to a server you administrate to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {guilds.map((guild) => (
            <Link
              key={guild.id}
              href={guild.botPresent ? `/dashboard/${guild.id}` : '#'}
              className={`card flex flex-col items-center gap-3 p-6 text-center transition-transform ${
                guild.botPresent ? 'hover:-translate-y-0.5 hover:border-discord-blurple' : 'opacity-50'
              }`}
            >
              {guild.icon ? (
                <Image
                  src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                  alt={guild.name}
                  width={64}
                  height={64}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-discord-panel2 text-xl font-bold text-white">
                  {guild.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="font-semibold text-white">{guild.name}</div>
              <span className="pill bg-discord-panel2 text-discord-muted">{guild.role}</span>
              {!guild.botPresent && <span className="text-xs text-discord-muted">Bot not installed</span>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
