import { SlashCommandBuilder, EmbedBuilder, MessageFlags, Events } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { prisma } from '../../../database/prisma';
import { grantXp, getLeaderboard, xpForLevel } from '../../../community/xp';
import { claimDaily, claimWeekly } from '../../../community/rewards';
import { consumeCooldown } from '../../../services/cooldowns';

export const xpModule: FeatureModule = {
  name: 'xp',
  description: 'Message/voice XP, levels, and daily/weekly reward streaks.',
  commands: [
    {
      data: new SlashCommandBuilder().setName('level').setDescription("Check a member's level and XP.").addUserOption((o) => o.setName('user').setDescription('User to check')),
      module: 'xp',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const target = interaction.options.getUser('user') ?? interaction.user;
        const settings = await getGuildSettings(interaction.guildId);
        const record = await prisma.xP.findUnique({ where: { guildId_userId: { guildId: interaction.guildId, userId: target.id } } });
        const level = record?.level ?? 0;
        const xp = record?.xp ?? 0;
        const nextLevelXp = xpForLevel(level + 1, settings.xpLevelUpBase);
        const currentLevelXp = xpForLevel(level, settings.xpLevelUpBase);
        const progress = nextLevelXp === currentLevelXp ? 1 : (xp - currentLevelXp) / (nextLevelXp - currentLevelXp);
        const bar = '█'.repeat(Math.round(progress * 15)) + '░'.repeat(15 - Math.round(progress * 15));

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
          .setTitle(`Level ${level}`)
          .setDescription(`\`${bar}\`\n${xp} / ${nextLevelXp} XP`);
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('leaderboard').setDescription('Show the server XP leaderboard.'),
      module: 'xp',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const rows = await getLeaderboard(interaction.guildId);
        if (rows.length === 0) {
          await interaction.reply({ content: 'No XP data yet — start chatting!', flags: MessageFlags.Ephemeral });
          return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        const description = rows.map((r, i) => `${medals[i] ?? `${i + 1}.`} <@${r.userId}> — Level ${r.level} (${r.xp} XP)`).join('\n');
        const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('📈 XP Leaderboard').setDescription(description);
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('daily').setDescription('Claim your daily reward.'),
      module: 'xp',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        const result = await claimDaily(interaction.guildId, interaction.user.id, settings.xpLevelUpBase);
        await interaction.reply({ content: result.message, flags: result.success ? undefined : MessageFlags.Ephemeral });
      }
    },
    {
      data: new SlashCommandBuilder().setName('weekly').setDescription('Claim your weekly reward.'),
      module: 'xp',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        const result = await claimWeekly(interaction.guildId, interaction.user.id, settings.xpLevelUpBase);
        await interaction.reply({ content: result.message, flags: result.success ? undefined : MessageFlags.Ephemeral });
      }
    }
  ],
  events: [
    {
      event: Events.MessageCreate,
      handler: async (message) => {
        if (message.author.bot || !message.guildId) return;
        const settings = await getGuildSettings(message.guildId);
        if (!settings.levelingEnabled) return;

        const key = `xp:${message.guildId}:${message.author.id}`;
        if (!consumeCooldown(key, settings.xpCooldownSec * 1000)) return;

        const result = await grantXp(message.guildId, message.author.id, settings.xpPerMessage, settings.xpLevelUpBase);
        if (result.leveledUp) {
          await message.channel
            .send(`🎉 ${message.author} leveled up to **Level ${result.newLevel}**!`)
            .catch(() => undefined);
        }
      }
    }
  ],
  onReady: async (ctx) => {
    setInterval(async () => {
      for (const guild of ctx.client.guilds.cache.values()) {
        const settings = await getGuildSettings(guild.id).catch(() => null);
        if (!settings?.levelingEnabled) continue;
        for (const channel of guild.channels.cache.values()) {
          if (!channel.isVoiceBased()) continue;
          for (const member of channel.members.values()) {
            if (member.user.bot) continue;
            await grantXp(guild.id, member.id, settings.xpPerVoiceMin, settings.xpLevelUpBase).catch(() => undefined);
          }
        }
      }
    }, 60_000).unref();
  }
};
