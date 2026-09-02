import type { Guild } from 'discord.js';
import { ChannelType } from 'discord.js';
import { prisma } from '../database/prisma';

interface BackupRole {
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
  position: number;
}

interface BackupChannel {
  name: string;
  type: number;
  parentName: string | null;
  position: number;
}

interface BackupData {
  roles: BackupRole[];
  channels: BackupChannel[];
}

export async function createBackup(guild: Guild, name: string, createdById: string) {
  const roles: BackupRole[] = guild.roles.cache
    .filter((r) => r.id !== guild.id)
    .map((r) => ({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield.toString(), position: r.position }));

  const channels: BackupChannel[] = guild.channels.cache.map((c) => ({
    name: c.name,
    type: c.type,
    parentName: c.parent?.name ?? null,
    position: 'position' in c ? c.position : 0
  }));

  const data: BackupData = { roles, channels };
  return prisma.serverBackup.create({ data: { guildId: guild.id, name, data: data as never, createdById } });
}

export async function listBackups(guildId: string) {
  return prisma.serverBackup.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' } });
}

/**
 * Recreates any roles/categories/channels from the snapshot that no longer exist by name.
 * This is intentionally additive (never deletes or overwrites current server structure) —
 * a destructive "wipe and replace" restore is too dangerous to run unattended from a slash command.
 */
export async function restoreBackup(guild: Guild, backupId: string): Promise<{ rolesCreated: number; channelsCreated: number }> {
  const backup = await prisma.serverBackup.findUnique({ where: { id: backupId } });
  if (!backup || backup.guildId !== guild.id) throw new Error('Backup not found');
  const data = backup.data as unknown as BackupData;

  let rolesCreated = 0;
  for (const role of [...data.roles].sort((a, b) => a.position - b.position)) {
    if (guild.roles.cache.some((r) => r.name === role.name)) continue;
    await guild.roles.create({ name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable, permissions: BigInt(role.permissions) });
    rolesCreated++;
  }

  let channelsCreated = 0;
  const categories = data.channels.filter((c) => c.type === ChannelType.GuildCategory);
  const others = data.channels.filter((c) => c.type !== ChannelType.GuildCategory);

  for (const cat of categories) {
    if (guild.channels.cache.some((c) => c.name === cat.name && c.type === ChannelType.GuildCategory)) continue;
    await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory });
    channelsCreated++;
  }
  for (const ch of others) {
    if (guild.channels.cache.some((c) => c.name === ch.name && c.type === ch.type)) continue;
    const parent = ch.parentName ? guild.channels.cache.find((c) => c.name === ch.parentName && c.type === ChannelType.GuildCategory) : null;
    await guild.channels.create({ name: ch.name, type: ch.type as never, parent: parent?.id });
    channelsCreated++;
  }

  return { rolesCreated, channelsCreated };
}
