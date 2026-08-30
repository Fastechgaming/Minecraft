import { SlashCommandBuilder, EmbedBuilder, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { getProfile, claimDaily, beg, gamble, deposit, withdraw, transfer, giveReputation, getEconomyLeaderboard } from '../../../economy/service';

async function guardEnabled(interaction: ChatInputCommandInteraction): Promise<string | null> {
  if (!interaction.guildId) return null;
  const settings = await getGuildSettings(interaction.guildId);
  if (!settings.economyEnabled) {
    await interaction.reply({ content: '🚫 Economy is disabled on this server.', flags: MessageFlags.Ephemeral });
    return null;
  }
  return interaction.guildId;
}

export const economyModule: FeatureModule = {
  name: 'economy',
  description: 'Coins, bank, daily/beg rewards, gambling, and reputation.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your (or someone else’s) coin balance.')
        .addUserOption((o) => o.setName('user').setDescription('User to check')),
      module: 'economy',
      execute: async (interaction) => {
        const guildId = await guardEnabled(interaction);
        if (!guildId) return;
        const target = interaction.options.getUser('user') ?? interaction.user;
        const settings = await getGuildSettings(guildId);
        const profile = await getProfile(guildId, target.id);

        const embed = new EmbedBuilder()
          .setColor(0xf0b232)
          .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
          .addFields(
            { name: 'Wallet', value: `${profile.coins} ${settings.economyCurrencySymbol}`, inline: true },
            { name: 'Bank', value: `${profile.bank} ${settings.economyCurrencySymbol}`, inline: true },
            { name: 'Total', value: `${profile.coins + profile.bank} ${settings.economyCurrencySymbol}`, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('daily').setDescription('Claim your daily coin reward.'),
      module: 'economy',
      execute: async (interaction) => {
        const guildId = await guardEnabled(interaction);
        if (!guildId) return;
        const settings = await getGuildSettings(guildId);
        const result = await claimDaily(guildId, interaction.user.id, settings.economyDailyAmount);
        const message = result.success ? `🎁 ${result.message} (streak: ${result.streak} day${result.streak === 1 ? '' : 's'})` : result.message;
        await interaction.reply({ content: message, flags: result.success ? undefined : MessageFlags.Ephemeral });
      }
    },
    {
      data: new SlashCommandBuilder().setName('beg').setDescription('Beg a random stranger for coins.'),
      module: 'economy',
      execute: async (interaction) => {
        const guildId = await guardEnabled(interaction);
        if (!guildId) return;
        const settings = await getGuildSettings(guildId);
        const result = await beg(guildId, interaction.user.id, settings.economyBegMin, settings.economyBegMax, settings.economyBegCooldownSec);
        await interaction.reply({ content: result.message, flags: result.success ? undefined : MessageFlags.Ephemeral });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Try your luck on the slots.')
        .addIntegerOption((o) => o.setName('coins').setDescription('Amount to bet (min 10)').setRequired(true).setMinValue(10)),
      module: 'economy',
      execute: async (interaction) => {
        const guildId = await guardEnabled(interaction);
        if (!guildId) return;
        const bet = interaction.options.getInteger('coins', true);
        const result = await gamble(guildId, interaction.user.id, bet);
        if (!result.success) {
          await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(result.reward! > 0 ? 0x23a559 : 0xda373c)
          .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
          .setDescription(`🎰 [ ${result.slots!.join(' | ')} ]\n\n${result.message}`)
          .setFooter({ text: `Updated balance: ${result.balance} coins` });
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Bank operations: deposit, withdraw, transfer.')
        .addSubcommand((sub) =>
          sub.setName('deposit').setDescription('Deposit coins into your bank.').addIntegerOption((o) => o.setName('coins').setDescription('Amount').setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) =>
          sub.setName('withdraw').setDescription('Withdraw coins from your bank.').addIntegerOption((o) => o.setName('coins').setDescription('Amount').setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) =>
          sub
            .setName('transfer')
            .setDescription('Transfer coins to another user.')
            .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
            .addIntegerOption((o) => o.setName('coins').setDescription('Amount').setRequired(true).setMinValue(1))
        ),
      module: 'economy',
      execute: async (interaction) => {
        const guildId = await guardEnabled(interaction);
        if (!guildId) return;
        const sub = interaction.options.getSubcommand();

        if (sub === 'deposit') {
          const result = await deposit(guildId, interaction.user.id, interaction.options.getInteger('coins', true));
          await interaction.reply({ content: result.message, flags: result.success ? undefined : MessageFlags.Ephemeral });
        } else if (sub === 'withdraw') {
          const result = await withdraw(guildId, interaction.user.id, interaction.options.getInteger('coins', true));
          await interaction.reply({ content: result.message, flags: result.success ? undefined : MessageFlags.Ephemeral });
        } else if (sub === 'transfer') {
          const user = interaction.options.getUser('user', true);
          const result = await transfer(guildId, interaction.user.id, user.id, interaction.options.getInteger('coins', true));
          await interaction.reply({ content: result.message, flags: result.success ? undefined : MessageFlags.Ephemeral });
        }
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('rep')
        .setDescription('View or give reputation.')
        .addSubcommand((sub) => sub.setName('view').setDescription("View a user's reputation.").addUserOption((o) => o.setName('user').setDescription('User to check')))
        .addSubcommand((sub) => sub.setName('give').setDescription('Give +1 reputation to a user.').addUserOption((o) => o.setName('user').setDescription('User to give rep to').setRequired(true))),
      module: 'economy',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const sub = interaction.options.getSubcommand();

        if (sub === 'view') {
          const target = interaction.options.getUser('user') ?? interaction.user;
          const profile = await getProfile(interaction.guildId, target.id);
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setAuthor({ name: `Reputation for ${target.username}`, iconURL: target.displayAvatarURL() })
            .addFields({ name: 'Given', value: `${profile.repGiven}`, inline: true }, { name: 'Received', value: `${profile.repReceived}`, inline: true });
          await interaction.reply({ embeds: [embed] });
          return;
        }

        const target = interaction.options.getUser('user', true);
        if (target.bot) {
          await interaction.reply({ content: 'You cannot give reputation to bots.', flags: MessageFlags.Ephemeral });
          return;
        }
        const result = await giveReputation(interaction.guildId, interaction.user.id, target.id);
        await interaction.reply({
          content: result.success ? `${target} ${result.message}` : result.message,
          flags: result.success ? undefined : MessageFlags.Ephemeral
        });
      }
    },
    {
      data: new SlashCommandBuilder().setName('richest').setDescription('Show the server’s wealthiest members.'),
      module: 'economy',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        const rows = await getEconomyLeaderboard(interaction.guildId);
        if (rows.length === 0) {
          await interaction.reply({ content: 'No economy activity yet.', flags: MessageFlags.Ephemeral });
          return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        const description = rows.map((r, i) => `${medals[i] ?? `${i + 1}.`} <@${r.userId}> — ${r.coins + r.bank} ${settings.economyCurrencySymbol}`).join('\n');
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf0b232).setTitle('💰 Richest Members').setDescription(description)] });
      }
    }
  ]
};
