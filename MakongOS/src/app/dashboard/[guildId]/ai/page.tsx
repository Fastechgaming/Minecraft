import { ChannelType } from 'discord.js';
import { getGuildSettings } from '../../../../database/settingsCache';
import { getBotClient } from '../../../../bot/globalClient';
import { getTodayUsage, getMonthUsageTotal } from '../../../../ai/usage';
import { StatCard } from '../../../../components/dashboard/StatCard';
import { AIStaffForm } from '../../../../components/dashboard/forms/AIStaffForm';

export default async function AIStaffPage({ params }: { params: { guildId: string } }) {
  const settings = await getGuildSettings(params.guildId);
  const client = getBotClient();
  const guild = client?.guilds.cache.get(params.guildId);
  const channels = guild
    ? [...guild.channels.cache.values()].filter((c) => c.type === ChannelType.GuildText).map((c) => ({ id: c.id, name: c.name }))
    : [];

  const [today, monthTotal] = await Promise.all([getTodayUsage(params.guildId), getMonthUsageTotal(params.guildId)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Staff Assistant</h1>
        <p className="text-discord-muted">Powered by Gemini — configure behavior, memory, and usage limits.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Messages Analyzed Today" value={today?.messagesAnalyzed ?? 0} hint={`limit ${settings.aiDailyLimit}/day`} />
        <StatCard label="Responses Today" value={today?.responses ?? 0} />
        <StatCard label="Escalations Today" value={today?.escalations ?? 0} />
        <StatCard label="Responses This Month" value={monthTotal} hint={`limit ${settings.aiMonthlyLimit}/mo`} />
      </div>

      <AIStaffForm guildId={params.guildId} initial={settings} channels={channels} />
    </div>
  );
}
