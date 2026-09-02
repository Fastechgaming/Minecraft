import { prisma } from '../../../../database/prisma';
import { getBotClient } from '../../../../bot/globalClient';
import { ChannelType } from 'discord.js';
import { LevelingForm } from '../../../../components/dashboard/forms/LevelingForm';
import { getLeaderboard } from '../../../../leveling/xp';

export default async function LevelingPage({ params }: { params: { guildId: string } }) {
  const settings = await prisma.guildSettings.upsert({ where: { guildId: params.guildId }, update: {}, create: { guildId: params.guildId } });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const roles = guild ? [...guild.roles.cache.filter((r) => r.id !== guild.id).values()].map((r) => ({ id: r.id, name: r.name })) : [];
  const textChannels = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).values()].map((c) => ({ id: c.id, name: c.name })) : [];
  const leaderboard = await getLeaderboard(params.guildId, settings.xpLevelUpBase, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leveling</h1>
        <p className="text-discord-muted">Text + voice XP rates, level-up announcements, and role rewards.</p>
      </div>
      <LevelingForm guildId={params.guildId} initialSettings={settings} roles={roles} textChannels={textChannels} />
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-discord-muted">No XP data yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {leaderboard.map((e) => (
              <li key={e.userId} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm text-white">
                <span>#{e.rank} — {e.userId}</span>
                <span className="text-discord-muted">Level {e.level} · {e.totalXp.toLocaleString()} XP</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
