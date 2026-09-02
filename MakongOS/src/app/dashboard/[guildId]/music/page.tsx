import { prisma } from '../../../../database/prisma';
import { getBotClient } from '../../../../bot/globalClient';
import { MusicForm } from '../../../../components/dashboard/forms/MusicForm';

export default async function MusicPage({ params }: { params: { guildId: string } }) {
  const settings = await prisma.guildSettings.upsert({ where: { guildId: params.guildId }, update: {}, create: { guildId: params.guildId } });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const roles = guild ? [...guild.roles.cache.filter((r) => r.id !== guild.id).values()].map((r) => ({ id: r.id, name: r.name })) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Music</h1>
        <p className="text-discord-muted">Queue limits, default volume, and DJ roles.</p>
      </div>
      <MusicForm guildId={params.guildId} initialSettings={settings} roles={roles} />
    </div>
  );
}
