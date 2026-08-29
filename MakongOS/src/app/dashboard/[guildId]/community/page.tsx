import { getGuildSettings } from '../../../../database/settingsCache';
import { getBotClient } from '../../../../bot/globalClient';
import { getLeaderboard } from '../../../../community/xp';
import { CommunitySettingsForm } from '../../../../components/dashboard/forms/CommunitySettingsForm';
import { ReactionRoleManager } from '../../../../components/dashboard/forms/ReactionRoleManager';
import { prisma } from '../../../../database/prisma';

export default async function CommunityPage({ params }: { params: { guildId: string } }) {
  const settings = await getGuildSettings(params.guildId);
  const leaderboard = await getLeaderboard(params.guildId, 5);
  const client = getBotClient();
  const guild = client?.guilds.cache.get(params.guildId);
  const roles = guild ? [...guild.roles.cache.values()].filter((r) => r.id !== guild.id).map((r) => ({ id: r.id, name: r.name })) : [];
  const panels = await prisma.reactionRolePanel.findMany({ where: { guildId: params.guildId } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Community</h1>
        <p className="text-discord-muted">XP rates, leaderboard, and self-assignable role panels.</p>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Top Members</h2>
        {leaderboard.length === 0 ? (
          <p className="text-discord-muted">No XP data yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {leaderboard.map((row, i) => (
              <li key={row.id} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm">
                <span className="text-white">
                  {['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} <span className="font-mono text-xs">{row.userId}</span>
                </span>
                <span className="text-discord-muted">Level {row.level} · {row.xp} XP</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <CommunitySettingsForm guildId={params.guildId} initial={settings} />
      <ReactionRoleManager guildId={params.guildId} roles={roles} initial={panels.map((p) => ({ id: p.id, title: p.title, style: p.style, options: p.options as never }))} />
    </div>
  );
}
