import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { grantTextXp, grantVoiceXp, getLeaderboard, getRank } from '../../../leveling/xp';
import { renderRankCard } from '../../../leveling/rankCard';

type LevelRoleReward = { level: number; roleId: string };

async function announceLevelUp(guildId: string, userId: string, newLevel: number, channelId: string | null, client: import('discord.js').Client, rewards: LevelRoleReward[]) {
  if (channelId) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased() && 'send' in channel) {
      await channel.send(`🎉 <@${userId}> leveled up to **level ${newLevel}**!`).catch(() => undefined);
    }
  }
  const reward = rewards.find((r) => r.level === newLevel);
  if (reward) {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    const member = await guild?.members.fetch(userId).catch(() => null);
    await member?.roles.add(reward.roleId).catch(() => undefined);
  }
}

export const levelingModule: FeatureModule = {
  name: 'leveling',
  description: 'Dual text + voice XP leveling with rank cards and a leaderboard.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('View a rank card')
        .addUserOption((o) => o.setName('user').setDescription('Member to look up').setRequired(false)),
      userInstallable: true,
      execute: async (interaction) => {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const settings = interaction.inGuild() ? await getGuildSettings(interaction.guildId) : null;
        const levelBase = settings?.xpLevelUpBase ?? 100;
        if (!interaction.inGuild()) {
          await interaction.reply({ content: 'Rank cards are only available inside a server.', ephemeral: true });
          return;
        }
        await interaction.deferReply();
        const rank = await getRank(interaction.guildId, target.id, levelBase);
        const buffer = await renderRankCard({
          username: target.username,
          avatarUrl: target.displayAvatarURL({ extension: 'png', size: 256 }),
          level: rank.level,
          rank: rank.rank,
          totalXp: rank.totalXp,
          textXp: rank.textXp,
          voiceXp: rank.voiceXp,
          levelBase
        });
        await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: 'rank.png' })] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('leaderboard').setDescription('Show the server XP leaderboard'),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        const entries = await getLeaderboard(interaction.guildId!, settings.xpLevelUpBase, 10);
        if (entries.length === 0) {
          await interaction.reply('No XP data yet — start chatting or hop in a voice channel!');
          return;
        }
        const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`);
        const embed = new EmbedBuilder()
          .setTitle(`🏆 ${interaction.guild!.name} Leaderboard`)
          .setColor(0xf1c40f)
          .setDescription(entries.map((e, i) => `${medal(i)} <@${e.userId}> — Level ${e.level} (${e.totalXp.toLocaleString()} XP)`).join('\n'));
        await interaction.reply({ embeds: [embed] });
      }
    }
  ],
  events: {
    messageCreate: async (message) => {
      if (!message.inGuild() || message.author.bot) return;
      const settings = await getGuildSettings(message.guildId);
      if (!settings.levelingEnabled) return;
      const result = await grantTextXp(message.guildId, message.author.id, settings.xpPerMessage, settings.xpCooldownSec, settings.xpLevelUpBase);
      if (result?.leveledUp) {
        const rewards = (settings.levelRoleRewards as unknown as LevelRoleReward[]) ?? [];
        await announceLevelUp(message.guildId, message.author.id, result.newLevel, settings.levelUpChannelId, message.client, rewards);
      }
    }
  },
  onReady: (client) => {
    setInterval(async () => {
      for (const guild of client.guilds.cache.values()) {
        const settings = await getGuildSettings(guild.id);
        if (!settings.levelingEnabled) continue;
        for (const [, state] of guild.voiceStates.cache) {
          if (!state.member || state.member.user.bot || !state.channelId) continue;
          if (state.mute || state.deaf || state.selfMute || state.selfDeaf) continue;
          const humanCount = state.channel?.members.filter((m) => !m.user.bot).size ?? 0;
          if (humanCount < 2) continue; // no XP for sitting alone in a voice channel
          const result = await grantVoiceXp(guild.id, state.member.id, settings.xpPerVoiceMin, settings.xpLevelUpBase);
          if (result.leveledUp) {
            const rewards = (settings.levelRoleRewards as unknown as LevelRoleReward[]) ?? [];
            await announceLevelUp(guild.id, state.member.id, result.newLevel, settings.levelUpChannelId, client, rewards);
          }
        }
      }
    }, 60_000);
  }
};
