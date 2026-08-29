import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { automationEngine } from '../../../automation/engine';

/**
 * The automation rule engine itself lives in src/automation/engine.ts and is
 * invoked directly by other modules (member join/leave, anti-spam, AI
 * moderation, command usage). This module just exposes a lightweight
 * `/automation list` command and a periodic "scheduled" trigger tick so
 * dashboard-configured rules with trigger=scheduled fire on their own.
 */
export const automationModule: FeatureModule = {
  name: 'automation',
  description: 'WHEN/IF/THEN automation rules configured from the dashboard.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('automation')
        .setDescription('Manage automation rules.')
        .addSubcommand((sub) => sub.setName('list').setDescription('List automation rules for this server.'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
      module: 'automation',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const rules = await prisma.automationRule.findMany({ where: { guildId: interaction.guildId } });
        if (rules.length === 0) {
          await interaction.reply({ content: 'No automation rules configured yet. Add some in the dashboard.', flags: MessageFlags.Ephemeral });
          return;
        }
        const description = rules.map((r) => `${r.enabled ? '🟢' : '⚪'} **${r.name}** — trigger: \`${r.trigger}\``).join('\n');
        await interaction.reply({ content: description, flags: MessageFlags.Ephemeral });
      }
    }
  ],
  onReady: async (ctx) => {
    setInterval(() => {
      for (const guild of ctx.client.guilds.cache.values()) {
        void automationEngine.trigger(ctx.client, 'scheduled', { guildId: guild.id });
      }
    }, 60_000).unref();
  }
};
