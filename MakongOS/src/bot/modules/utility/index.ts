import { SlashCommandBuilder, EmbedBuilder, MessageFlags, Events, version as djsVersion } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { getBotStartedAt } from '../../globalClient';
import { grantXp, getLeaderboard, xpForLevel } from '../../../stats/xp';
import { prisma } from '../../../database/prisma';
import { consumeCooldown } from '../../../services/cooldowns';

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MakongOS-Discord-Bot' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function formatDuration(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ') || '0s';
}

export const utilityModule: FeatureModule = {
  name: 'utility',
  description: 'Avatar/userinfo/botstats utility commands plus the XP/leveling system.',
  commands: [
    {
      data: new SlashCommandBuilder().setName('avatar').setDescription("Show a user's avatar.").addUserOption((o) => o.setName('user').setDescription('User')),
      module: 'utility',
      execute: async (interaction) => {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`${target.username}'s Avatar`)
          .setImage(target.displayAvatarURL({ size: 1024 }));
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('userinfo').setDescription('Show information about a member.').addUserOption((o) => o.setName('user').setDescription('User')),
      module: 'utility',
      execute: async (interaction) => {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: 'Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
            ...(member?.joinedTimestamp ? [{ name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }] : []),
            ...(member ? [{ name: 'Roles', value: `${member.roles.cache.size - 1}`, inline: true }] : [])
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('botstats').setDescription('Show bot statistics.'),
      module: 'utility',
      execute: async (interaction) => {
        const startedAt = getBotStartedAt();
        const uptimeSec = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
        const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🤖 Bot Statistics')
          .addFields(
            { name: 'Servers', value: `${interaction.client.guilds.cache.size}`, inline: true },
            { name: 'Uptime', value: formatDuration(uptimeSec), inline: true },
            { name: 'WS Ping', value: `${interaction.client.ws.ping}ms`, inline: true },
            { name: 'Memory', value: `${memMb}MB`, inline: true },
            { name: 'discord.js', value: djsVersion, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('urban')
        .setDescription('Look up a term on Urban Dictionary.')
        .addStringOption((o) => o.setName('term').setDescription('Term to look up').setRequired(true)),
      module: 'utility',
      execute: async (interaction) => {
        await interaction.deferReply();
        const term = interaction.options.getString('term', true);
        const data = await fetchJson<{ list: { definition: string; example: string; permalink: string; thumbs_up: number }[] }>(
          `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`
        );
        const entry = data?.list?.[0];
        if (!entry) {
          await interaction.editReply(`❌ No definition found for **${term}**.`);
          return;
        }
        const clean = (s: string) => s.replace(/[[\]]/g, '').slice(0, 1000);
        const embed = new EmbedBuilder()
          .setColor(0x1d2439)
          .setTitle(`📖 ${term}`)
          .setURL(entry.permalink)
          .addFields({ name: 'Definition', value: clean(entry.definition) }, { name: 'Example', value: clean(entry.example) || 'N/A' })
          .setFooter({ text: `👍 ${entry.thumbs_up}` });
        await interaction.editReply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('bigemoji').setDescription('Get a large version of an emoji.').addStringOption((o) => o.setName('emoji').setDescription('The emoji').setRequired(true)),
      module: 'utility',
      execute: async (interaction) => {
        const emoji = interaction.options.getString('emoji', true).trim();
        const customMatch = emoji.match(/^<a?:\w+:(\d+)>$/);
        if (customMatch) {
          const animated = emoji.startsWith('<a:');
          const url = `https://cdn.discordapp.com/emojis/${customMatch[1]}.${animated ? 'gif' : 'png'}?size=512`;
          await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setImage(url)] });
          return;
        }

        const codepoints = [...emoji].map((c) => c.codePointAt(0)!.toString(16)).join('-');
        const url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${codepoints}.png`;
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setImage(url)] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('rank').setDescription("Check a member's level and XP.").addUserOption((o) => o.setName('user').setDescription('User to check')),
      module: 'utility',
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
      module: 'utility',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const rows = await getLeaderboard(interaction.guildId);
        if (rows.length === 0) {
          await interaction.reply({ content: 'No XP data yet — start chatting!', flags: MessageFlags.Ephemeral });
          return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        const description = rows.map((r, i) => `${medals[i] ?? `${i + 1}.`} <@${r.userId}> — Level ${r.level} (${r.xp} XP)`).join('\n');
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('📈 XP Leaderboard').setDescription(description)] });
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
          await message.channel.send(`🎉 ${message.author} leveled up to **Level ${result.newLevel}**!`).catch(() => undefined);
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
