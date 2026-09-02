import {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  type VoiceChannel
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { logAudit } from '../../../services/auditLog';

function controlPanel(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('vh_lock').setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vh_unlock').setLabel('Unlock').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vh_hide').setLabel('Hide').setEmoji('🙈').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vh_unhide').setLabel('Unhide').setEmoji('👁️').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('vh_rename').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('vh_limit').setLabel('Set Limit').setEmoji('🔢').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('vh_kick').setLabel('Kick').setEmoji('👢').setStyle(ButtonStyle.Danger)
  );
  return [row1, row2];
}

async function requireOwner(channelId: string, userId: string): Promise<boolean> {
  const record = await prisma.tempVoiceChannel.findUnique({ where: { channelId } });
  return record?.ownerId === userId;
}

export const voiceHubModule: FeatureModule = {
  name: 'voicehub',
  description: 'Join-to-create temporary voice channels with an owner control panel.',
  events: {
    voiceStateUpdate: async (oldState, newState) => {
      const settings = await getGuildSettings(newState.guild.id);
      if (!settings.voiceHubEnabled) return;

      // Joined the hub setup channel — create a personal channel.
      if (newState.channelId && newState.channelId === settings.voiceHubSetupChannelId && oldState.channelId !== newState.channelId && newState.member) {
        const name = settings.voiceHubDefaultName.replace('{user}', newState.member.user.username);
        const channel = await newState.guild.channels.create({
          name: name.slice(0, 100),
          type: ChannelType.GuildVoice,
          parent: settings.voiceHubCategoryId ?? newState.channel?.parentId ?? undefined,
          userLimit: settings.voiceHubDefaultLimit,
          permissionOverwrites: [
            { id: newState.member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] }
          ]
        });
        await prisma.tempVoiceChannel.create({ data: { guildId: newState.guild.id, channelId: channel.id, ownerId: newState.member.id } });
        await newState.member.voice.setChannel(channel).catch(() => undefined);

        const embed = new EmbedBuilder()
          .setTitle(`🔊 ${newState.member.displayName}'s Channel`)
          .setDescription('Use the buttons below to manage your channel — only you can use them.')
          .setColor(0x5865f2);
        await channel.send({ embeds: [embed], components: controlPanel() }).catch(() => undefined);
        await logAudit(newState.guild.id, 'voice_hub', `Created temp voice channel for ${newState.member.user.tag}`, newState.member.id);
      }

      // Left a temp channel — delete it if now empty.
      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const record = await prisma.tempVoiceChannel.findUnique({ where: { channelId: oldState.channelId } });
        if (record && oldState.channel && oldState.channel.members.size === 0) {
          await oldState.channel.delete().catch(() => undefined);
          await prisma.tempVoiceChannel.delete({ where: { channelId: oldState.channelId } }).catch(() => undefined);
        }
      }
    }
  },
  components: [
    {
      prefix: 'vh_',
      handleButton: async (interaction) => {
        if (!interaction.channelId || !(await requireOwner(interaction.channelId, interaction.user.id))) {
          await interaction.reply({ content: 'Only the channel owner can use these controls.', ephemeral: true });
          return;
        }
        const channel = interaction.channel as VoiceChannel;
        const everyoneId = interaction.guild!.roles.everyone.id;

        switch (interaction.customId) {
          case 'vh_lock':
            await channel.permissionOverwrites.edit(everyoneId, { Connect: false });
            await interaction.reply({ content: '🔒 Channel locked.', ephemeral: true });
            return;
          case 'vh_unlock':
            await channel.permissionOverwrites.edit(everyoneId, { Connect: null });
            await interaction.reply({ content: '🔓 Channel unlocked.', ephemeral: true });
            return;
          case 'vh_hide':
            await channel.permissionOverwrites.edit(everyoneId, { ViewChannel: false });
            await interaction.reply({ content: '🙈 Channel hidden.', ephemeral: true });
            return;
          case 'vh_unhide':
            await channel.permissionOverwrites.edit(everyoneId, { ViewChannel: null });
            await interaction.reply({ content: '👁️ Channel visible again.', ephemeral: true });
            return;
          case 'vh_rename': {
            const modal = new ModalBuilder()
              .setCustomId('vh_rename_modal')
              .setTitle('Rename Channel')
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                  new TextInputBuilder().setCustomId('name').setLabel('New name').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)
                )
              );
            await interaction.showModal(modal);
            return;
          }
          case 'vh_limit': {
            const modal = new ModalBuilder()
              .setCustomId('vh_limit_modal')
              .setTitle('Set Member Limit')
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                  new TextInputBuilder().setCustomId('limit').setLabel('Limit (0 = unlimited)').setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true)
                )
              );
            await interaction.showModal(modal);
            return;
          }
          case 'vh_kick': {
            const members = channel.members.filter((m) => m.id !== interaction.user.id);
            if (members.size === 0) {
              await interaction.reply({ content: 'Nobody else is in your channel.', ephemeral: true });
              return;
            }
            const select = new StringSelectMenuBuilder()
              .setCustomId('vh_kick_select')
              .setPlaceholder('Select a member to kick')
              .addOptions(members.map((m) => ({ label: m.displayName, value: m.id })).slice(0, 25));
            await interaction.reply({ components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)], ephemeral: true });
            return;
          }
        }
      },
      handleSelect: async (interaction) => {
        if (interaction.customId !== 'vh_kick_select') return;
        if (!interaction.channelId || !(await requireOwner(interaction.channelId, interaction.user.id))) {
          await interaction.reply({ content: 'Only the channel owner can use these controls.', ephemeral: true });
          return;
        }
        const channel = interaction.channel as VoiceChannel;
        const targetId = interaction.values[0];
        const member = channel.members.get(targetId);
        await member?.voice.disconnect('Kicked by channel owner').catch(() => undefined);
        await interaction.update({ content: member ? `👢 Kicked ${member.displayName}.` : 'That member already left.', components: [] });
      },
      handleModal: async (interaction) => {
        if (!interaction.channelId || !(await requireOwner(interaction.channelId, interaction.user.id))) {
          await interaction.reply({ content: 'Only the channel owner can use these controls.', ephemeral: true });
          return;
        }
        const channel = interaction.channel as VoiceChannel;
        if (interaction.customId === 'vh_rename_modal') {
          const name = interaction.fields.getTextInputValue('name');
          await channel.setName(name.slice(0, 100));
          await interaction.reply({ content: `✏️ Renamed to **${name}**.`, ephemeral: true });
        } else if (interaction.customId === 'vh_limit_modal') {
          const limit = Math.max(0, Math.min(99, Number(interaction.fields.getTextInputValue('limit')) || 0));
          await channel.setUserLimit(limit);
          await interaction.reply({ content: `🔢 Limit set to ${limit === 0 ? 'unlimited' : limit}.`, ephemeral: true });
        }
      }
    }
  ]
};
