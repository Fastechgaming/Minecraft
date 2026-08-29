import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type TextChannel,
  type GuildMember
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';

interface RoleOption {
  label: string;
  emoji?: string;
  roleId: string;
}

function buildComponents(panelId: string, style: string, options: RoleOption[]) {
  if (style === 'dropdown') {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`rolepanel_select_${panelId}`)
      .setPlaceholder('Choose your roles')
      .setMinValues(0)
      .setMaxValues(options.length)
      .addOptions(options.map((o) => ({ label: o.label, value: o.roleId, emoji: o.emoji || undefined })));
    return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)];
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < options.length; i += 5) {
    const chunk = options.slice(i, i + 5);
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        chunk.map((o) => {
          const btn = new ButtonBuilder().setCustomId(`rolepanel_btn_${panelId}_${o.roleId}`).setLabel(o.label).setStyle(ButtonStyle.Secondary);
          if (o.emoji) btn.setEmoji(o.emoji);
          return btn;
        })
      )
    );
  }
  return rows;
}

export const rolesModule: FeatureModule = {
  name: 'roles',
  description: 'Button and dropdown self-assignable role panels, built from the dashboard.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('rolepanel')
        .setDescription('Post a self-role panel configured in the dashboard.')
        .addStringOption((o) => o.setName('id').setDescription('Panel ID from the dashboard').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
      module: 'roles',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const panel = await prisma.reactionRolePanel.findFirst({ where: { id: interaction.options.getString('id', true), guildId: interaction.guildId } });
        if (!panel) {
          await interaction.reply({ content: '❌ Panel not found. Create one in the dashboard first.', flags: MessageFlags.Ephemeral });
          return;
        }
        const options = panel.options as unknown as RoleOption[];
        const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(panel.title).setDescription(options.map((o) => `${o.emoji ?? '•'} <@&${o.roleId}>`).join('\n'));
        const components = buildComponents(panel.id, panel.style, options);
        const message = await (interaction.channel as TextChannel).send({ embeds: [embed], components });
        await prisma.reactionRolePanel.update({ where: { id: panel.id }, data: { channelId: message.channelId, messageId: message.id } });
        await interaction.reply({ content: '✅ Role panel posted.', flags: MessageFlags.Ephemeral });
      }
    }
  ],
  components: [
    {
      prefix: 'rolepanel_btn_',
      button: async (interaction) => {
        const rest = interaction.customId.replace('rolepanel_btn_', '');
        const roleId = rest.slice(rest.lastIndexOf('_') + 1);
        const member = interaction.member as GuildMember;
        const has = member.roles.cache.has(roleId);
        if (has) await member.roles.remove(roleId).catch(() => undefined);
        else await member.roles.add(roleId).catch(() => undefined);
        await interaction.reply({ content: has ? `➖ Removed <@&${roleId}>` : `➕ Added <@&${roleId}>`, flags: MessageFlags.Ephemeral });
      }
    },
    {
      prefix: 'rolepanel_select_',
      select: async (interaction) => {
        const member = interaction.member as GuildMember;
        const panelId = interaction.customId.replace('rolepanel_select_', '');
        const panel = await prisma.reactionRolePanel.findUnique({ where: { id: panelId } });
        if (!panel) return;
        const options = panel.options as unknown as RoleOption[];
        const selected = new Set(interaction.values);

        for (const option of options) {
          const shouldHave = selected.has(option.roleId);
          const has = member.roles.cache.has(option.roleId);
          if (shouldHave && !has) await member.roles.add(option.roleId).catch(() => undefined);
          if (!shouldHave && has) await member.roles.remove(option.roleId).catch(() => undefined);
        }
        await interaction.reply({ content: '✅ Roles updated.', flags: MessageFlags.Ephemeral });
      }
    }
  ]
};
