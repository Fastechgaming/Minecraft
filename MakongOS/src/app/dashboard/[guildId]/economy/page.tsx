import { getGuildSettings } from '../../../../database/settingsCache';
import { getEconomyLeaderboard } from '../../../../economy/service';
import { EconomySettingsForm } from '../../../../components/dashboard/forms/EconomySettingsForm';

export default async function EconomyPage({ params }: { params: { guildId: string } }) {
  const settings = await getGuildSettings(params.guildId);
  const leaderboard = await getEconomyLeaderboard(params.guildId, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Economy</h1>
        <p className="text-discord-muted">Currency symbol, daily/beg reward amounts, and cooldowns.</p>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Richest Members</h2>
        {leaderboard.length === 0 ? (
          <p className="text-discord-muted">No economy activity yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {leaderboard.map((row, i) => (
              <li key={row.id} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm">
                <span className="text-white">
                  {['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} <span className="font-mono text-xs">{row.userId}</span>
                </span>
                <span className="text-discord-muted">
                  {row.coins + row.bank} {settings.economyCurrencySymbol}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <EconomySettingsForm guildId={params.guildId} initial={settings} />
    </div>
  );
}
