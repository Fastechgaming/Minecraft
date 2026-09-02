import { prisma } from '../../../../database/prisma';
import { getBotClient } from '../../../../bot/globalClient';
import { ChannelType } from 'discord.js';
import { AIForm } from '../../../../components/dashboard/forms/AIForm';
import { StatCard } from '../../../../components/dashboard/StatCard';

export default async function AIPage({ params }: { params: { guildId: string } }) {
  const settings = await prisma.guildSettings.upsert({ where: { guildId: params.guildId }, update: {}, create: { guildId: params.guildId } });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const textChannels = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).values()].map((c) => ({ id: c.id, name: c.name })) : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const usage = await prisma.aIUsage.findUnique({ where: { guildId_date: { guildId: params.guildId, date: today } } });
  const openEscalations = await prisma.aIEscalation.count({ where: { guildId: params.guildId, resolved: false } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
        <p className="text-discord-muted">Gemini-powered chat, personality, and staff escalation.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Chat Messages Today" value={usage?.chatMessages ?? 0} />
        <StatCard label="Images Generated Today" value={usage?.imagesGenerated ?? 0} />
        <StatCard label="Scans Performed Today" value={usage?.scansPerformed ?? 0} />
        <StatCard label="Open Escalations" value={openEscalations} />
      </div>
      <AIForm guildId={params.guildId} initialSettings={settings} textChannels={textChannels} />
    </div>
  );
}
