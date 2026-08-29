import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, type TextChannel } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { prisma } from '../../../database/prisma';
import { applyPlaceholders } from '../../../community/placeholders';
import { recordAuditLog } from '../../../services/auditLog';
import { automationEngine } from '../../../automation/engine';

interface ButtonLink {
  label: string;
  url: string;
}

export const welcomeModule: FeatureModule = {
  name: 'welcome',
  description: 'Customizable welcome/leave embeds with optional DM and quick-link buttons.',
  events: [
    {
      event: Events.GuildMemberAdd,
      handler: async (member) => {
        const settings = await getGuildSettings(member.guild.id);
        await prisma.member.upsert({
          where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
          create: { guildId: member.guild.id, userId: member.id },
          update: { leftAt: null }
        });
        await prisma.user.upsert({
          where: { id: member.id },
          create: { id: member.id, username: member.user.username, avatar: member.user.avatar },
          update: { username: member.user.username, avatar: member.user.avatar }
        });

        if (settings.defaultRoleIds.length > 0) {
          await member.roles.add(settings.defaultRoleIds).catch(() => undefined);
        }

        await recordAuditLog(member.client, { guildId: member.guild.id, type: 'member_join', action: 'joined', userId: member.id });
        await automationEngine.trigger(member.client, 'member_join', { guildId: member.guild.id, userId: member.id });

        if (!settings.welcomeEnabled) return;

        const config = await prisma.welcomeConfig.findUnique({ where: { guildId: member.guild.id } });
        const title = applyPlaceholders(config?.embedTitle ?? '👋 Welcome {user}!', { member, guild: member.guild });
        const description = applyPlaceholders(
          config?.embedDescription ?? 'Welcome to {server}! You are member #{member_count}.',
          { member, guild: member.guild }
        );

        const embed = new EmbedBuilder()
          .setColor((config?.embedColor ?? settings.embedColor) as `#${string}`)
          .setTitle(title)
          .setDescription(description)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp(new Date());
        if (config?.embedImage) embed.setImage(config.embedImage);

        const buttons = (config?.buttons as ButtonLink[] | null) ?? [];
        const row = buttons.length
          ? new ActionRowBuilder<ButtonBuilder>().addComponents(
              buttons.slice(0, 5).map((b) => new ButtonBuilder().setLabel(b.label).setURL(b.url).setStyle(ButtonStyle.Link))
            )
          : undefined;

        if (settings.welcomeChannelId) {
          const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
          if (channel?.isTextBased()) {
            await (channel as TextChannel).send({ embeds: [embed], components: row ? [row] : [] }).catch(() => undefined);
          }
        }

        if (config?.dmEnabled) {
          const dmContent = applyPlaceholders(config.dmMessage ?? description, { member, guild: member.guild });
          await member.send(dmContent).catch(() => undefined);
        }
      }
    },
    {
      event: Events.GuildMemberRemove,
      handler: async (member) => {
        const guild = member.guild;
        const settings = await getGuildSettings(guild.id);
        await prisma.member
          .update({ where: { guildId_userId: { guildId: guild.id, userId: member.id } }, data: { leftAt: new Date() } })
          .catch(() => undefined);

        await recordAuditLog(member.client, { guildId: guild.id, type: 'member_leave', action: 'left', userId: member.id });
        await automationEngine.trigger(member.client, 'member_leave', { guildId: guild.id, userId: member.id });

        const config = await prisma.welcomeConfig.findUnique({ where: { guildId: guild.id } });
        if (!config?.leaveEnabled || !settings.leaveChannelId) return;

        const channel = await guild.channels.fetch(settings.leaveChannelId).catch(() => null);
        if (!channel?.isTextBased()) return;

        const content = applyPlaceholders(config.leaveMessage, { user: member.user, guild });
        const embed = new EmbedBuilder().setColor(0xf0b232).setDescription(content).setThumbnail(member.user.displayAvatarURL());
        await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
      }
    }
  ]
};
