import { SlashCommandBuilder, EmbedBuilder, MessageFlags, type TextChannel } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { queryMinecraftServer } from '../../../providers/minecraft/statusProvider';

function statusEmbed(name: string, edition: string, host: string, port: number, result: Awaited<ReturnType<typeof queryMinecraftServer>>) {
  const embed = new EmbedBuilder()
    .setColor(result.online ? 0x23a559 : 0xda373c)
    .setTitle(`${result.online ? '🟢' : '🔴'} ${name} — ${result.online ? 'Online' : 'Offline'}`)
    .setTimestamp(new Date());

  if (result.online) {
    embed.addFields(
      { name: 'Players', value: `${result.players.online} / ${result.players.max}`, inline: true },
      { name: 'Version', value: result.version ?? 'Unknown', inline: true },
      { name: 'Ping', value: `${result.latencyMs ?? '?'}ms`, inline: true },
      { name: 'Address', value: `\`${host}:${port}\` (${edition})`, inline: false }
    );
    if (result.players.sample.length > 0) {
      embed.addFields({ name: 'Online Now', value: result.players.sample.slice(0, 12).join(', ') });
    }
  } else {
    embed.setDescription(`Could not reach \`${host}:${port}\`.`);
  }
  return embed;
}

export const minecraftModule: FeatureModule = {
  name: 'minecraft',
  description: 'Java/Bedrock Minecraft server status, player lookup, and a live status panel.',
  commands: [
    {
      data: new SlashCommandBuilder().setName('server').setDescription('Show configured Minecraft server status.'),
      module: 'minecraft',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const servers = await prisma.minecraftServer.findMany({ where: { guildId: interaction.guildId } });
        if (servers.length === 0) {
          await interaction.reply({ content: 'No Minecraft server is configured. Add one in the dashboard.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.deferReply();
        const results = await Promise.all(
          servers.map(async (s) => statusEmbed(s.name, s.edition, s.host, s.port, await queryMinecraftServer(s.host, s.port, s.edition as 'java' | 'bedrock')))
        );
        await interaction.editReply({ embeds: results.slice(0, 10) });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('player')
        .setDescription('Check if a player is currently online.')
        .addStringOption((o) => o.setName('username').setDescription('Minecraft username').setRequired(true)),
      module: 'minecraft',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const username = interaction.options.getString('username', true);
        const servers = await prisma.minecraftServer.findMany({ where: { guildId: interaction.guildId } });
        if (servers.length === 0) {
          await interaction.reply({ content: 'No Minecraft server is configured.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.deferReply();
        for (const s of servers) {
          const result = await queryMinecraftServer(s.host, s.port, s.edition as 'java' | 'bedrock');
          if (result.players.sample.some((p) => p.toLowerCase() === username.toLowerCase())) {
            await interaction.editReply(`🟢 **${username}** is currently online on **${s.name}**.`);
            return;
          }
        }
        await interaction.editReply(`🔴 **${username}** does not appear to be online right now (based on the visible player sample).`);
      }
    }
  ],
  onReady: async (ctx) => {
    setInterval(async () => {
      const servers = await prisma.minecraftServer.findMany({ where: { statusChannelId: { not: null } } });
      for (const server of servers) {
        try {
          const result = await queryMinecraftServer(server.host, server.port, server.edition as 'java' | 'bedrock');
          const channel = await ctx.client.channels.fetch(server.statusChannelId!).catch(() => null);
          if (!channel?.isTextBased()) continue;
          const embed = statusEmbed(server.name, server.edition, server.host, server.port, result);

          if (server.statusMessageId) {
            const msg = await (channel as TextChannel).messages.fetch(server.statusMessageId).catch(() => null);
            if (msg) {
              await msg.edit({ embeds: [embed] }).catch(() => undefined);
              continue;
            }
          }
          const sent = await (channel as TextChannel).send({ embeds: [embed] });
          await prisma.minecraftServer.update({ where: { id: server.id }, data: { statusMessageId: sent.id } });
        } catch {
          // Non-fatal — retried on next interval.
        }
      }
    }, 60_000).unref();
  }
};
