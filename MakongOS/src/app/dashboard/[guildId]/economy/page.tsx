import { prisma } from '../../../../database/prisma';
import { getBotClient } from '../../../../bot/globalClient';
import { EconomyForm } from '../../../../components/dashboard/forms/EconomyForm';
import { ShopManager } from '../../../../components/dashboard/forms/ShopManager';

export default async function EconomyPage({ params }: { params: { guildId: string } }) {
  const settings = await prisma.guildSettings.upsert({ where: { guildId: params.guildId }, update: {}, create: { guildId: params.guildId } });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const roles = guild ? [...guild.roles.cache.filter((r) => r.id !== guild.id).values()].map((r) => ({ id: r.id, name: r.name })) : [];
  const shopItems = await prisma.shopItem.findMany({ where: { guildId: params.guildId }, orderBy: { price: 'asc' } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Economy</h1>
        <p className="text-discord-muted">Currency, daily/work amounts, robbing, and the shop.</p>
      </div>
      <EconomyForm guildId={params.guildId} initialSettings={settings} />
      <ShopManager guildId={params.guildId} initialItems={shopItems} roles={roles} />
    </div>
  );
}
