import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, type TextChannel } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { isStaff } from '../../../services/permissions';

type RoleOption = { roleId: string; label: string; emoji: string };

function buildSelect(panelId: string, options: RoleOption[]): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`reactionrole_select_${panelId}`)
    .setPlaceholder('Select your roles...')
    .setMinValues(0)
    .setMaxValues(options.length)
    .addOptions(options.map((o) => ({ label: o.label, value: o.roleId, emoji: o.emoji || undefined })));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

async function requireStaff(interaction: import('discord.js').ChatInputCommandInteraction): Promise<boolean> {
  const settings = await getGuildSettings(interaction.guildId!);
  const member = interaction.member;
  if (!member || !('roles' in member) || !isStaff(member as never, settings)) {
    await interaction.reply({ content: 'You need a staff role to manage reaction roles.', ephemeral: true });
    return false;
  }
  return true;
}

export const reactionRolesModule: FeatureModule = {
  name: 'reactionroles',
  description: 'Dropdown reaction-role panels.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Manage reaction role panels')
        .addSubcommand((s) => s.setName('new').setDescription('Create a new panel').addStringOption((o) => o.setName('title').setDescription('Panel title').setRequired(true)))
        .addSubcommand((s) =>
          s
            .setName('addrole')
            .setDescription('Add a role to a panel')
            .addStringOption((o) => o.setName('panel_id').setDescription('Panel ID from /reactionrole new').setRequired(true))
            .addRoleOption((o) => o.setName('role').setDescription('Role to grant').setRequired(true))
            .addStringOption((o) => o.setName('label').setDescription('Button label').setRequired(true))
            .addStringOption((o) => o.setName('emoji').setDescription('Emoji').setRequired(false))
        )
        .addSubcommand((s) =>
          s.setName('post').setDescription('Post a panel to a channel').addStringOption((o) => o.setName('panel_id').setDescription('Panel ID').setRequired(true))
        ),
      execute: async (interaction) => {
        if (!(await requireStaff(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        if (!settings.reactionRolesEnabled) {
          await interaction.reply({ content: 'Reaction roles are disabled on this server.', ephemeral: true });
          return;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'new') {
          const title = interaction.options.getString('title', true);
          const panel = await prisma.reactionRolePanel.create({ data: { guildId: interaction.guildId!, channelId: interaction.channelId, title } });
          await interaction.reply(`✅ Created panel **${title}**. ID: \`${panel.id}\`\nAdd roles with \`/reactionrole addrole panel_id:${panel.id}\`, then post it with \`/reactionrole post\`.`);
        } else if (sub === 'addrole') {
          const panelId = interaction.options.getString('panel_id', true);
          const panel = await prisma.reactionRolePanel.findUnique({ where: { id: panelId } });
          if (!panel || panel.guildId !== interaction.guildId) {
            await interaction.reply({ content: 'Panel not found.', ephemeral: true });
            return;
          }
          const role = interaction.options.getRole('role', true);
          const label = interaction.options.getString('label', true);
          const emoji = interaction.options.getString('emoji') ?? '';
          const options = (panel.options as unknown as RoleOption[]) ?? [];
          if (options.length >= 25) {
            await interaction.reply({ content: 'A panel can have at most 25 roles.', ephemeral: true });
            return;
          }
          options.push({ roleId: role.id, label, emoji });
          await prisma.reactionRolePanel.update({ where: { id: panel.id }, data: { options } });
          await interaction.reply(`✅ Added **${label}** → <@&${role.id}> to the panel.`);
        } else {
          const panelId = interaction.options.getString('panel_id', true);
          const panel = await prisma.reactionRolePanel.findUnique({ where: { id: panelId } });
          if (!panel || panel.guildId !== interaction.guildId) {
            await interaction.reply({ content: 'Panel not found.', ephemeral: true });
            return;
          }
          const options = (panel.options as unknown as RoleOption[]) ?? [];
          if (options.length === 0) {
            await interaction.reply({ content: 'Add at least one role first with `/reactionrole addrole`.', ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder().setTitle(panel.title).setDescription('Select roles from the dropdown below.').setColor(0x5865f2);
          const message = await (interaction.channel as TextChannel).send({ embeds: [embed], components: [buildSelect(panel.id, options)] });
          await prisma.reactionRolePanel.update({ where: { id: panel.id }, data: { messageId: message.id } });
          await interaction.reply({ content: '✅ Panel posted.', ephemeral: true });
        }
      }
    }
  ],
  components: [
    {
      prefix: 'reactionrole_select_',
      handleSelect: async (interaction) => {
        const panelId = interaction.customId.replace('reactionrole_select_', '');
        const panel = await prisma.reactionRolePanel.findUnique({ where: { id: panelId } });
        if (!panel) {
          await interaction.reply({ content: 'This panel no longer exists.', ephemeral: true });
          return;
        }
        const options = (panel.options as unknown as RoleOption[]) ?? [];
        const allRoleIds = options.map((o) => o.roleId);
        const selected = new Set(interaction.values);
        const member = interaction.member as import('discord.js').GuildMember;

        const toAdd = allRoleIds.filter((id) => selected.has(id) && !member.roles.cache.has(id));
        const toRemove = allRoleIds.filter((id) => !selected.has(id) && member.roles.cache.has(id));

        for (const roleId of toAdd) await member.roles.add(roleId).catch(() => undefined);
        for (const roleId of toRemove) await member.roles.remove(roleId).catch(() => undefined);

        await interaction.reply({ content: `✅ Updated your roles (${toAdd.length} added, ${toRemove.length} removed).`, ephemeral: true });
      }
    }
  ]
};
