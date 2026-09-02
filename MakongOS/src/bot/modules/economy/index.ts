import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import * as economy from '../../../economy/service';
import { flipCoin, spinSlots, startBlackjack, playerHit, resolveDealerAndSettle, handValue, cardLabel, type BlackjackSession } from '../../../economy/gambling';

function fmt(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString()}`;
}

async function guardEnabled(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const settings = await getGuildSettings(interaction.guildId!);
  if (!settings.economyEnabled) {
    await interaction.reply({ content: 'Economy is disabled on this server.', ephemeral: true });
    return false;
  }
  return true;
}

const blackjackSessions = new Map<string, { session: BlackjackSession; userId: string; guildId: string; symbol: string }>();

function blackjackEmbed(session: BlackjackSession, symbol: string, reveal: boolean): EmbedBuilder {
  const playerCards = session.player.map(cardLabel).join(' ');
  const dealerCards = reveal ? session.dealer.map(cardLabel).join(' ') : `${cardLabel(session.dealer[0])} 🂠`;
  return new EmbedBuilder()
    .setTitle('🃏 Blackjack')
    .setColor(0x2ecc71)
    .addFields(
      { name: `Your hand (${handValue(session.player)})`, value: playerCards, inline: false },
      { name: `Dealer's hand${reveal ? ` (${handValue(session.dealer)})` : ''}`, value: dealerCards, inline: false },
      { name: 'Bet', value: fmt(session.bet, symbol), inline: false }
    );
}

function blackjackButtons(disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
  );
}

export const economyModule: FeatureModule = {
  name: 'economy',
  description: 'Bank, shop, work/daily rewards, and gambling minigames.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check a wallet/bank balance')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(false)),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const target = interaction.options.getUser('user') ?? interaction.user;
        const settings = await getGuildSettings(interaction.guildId!);
        const profile = await economy.getProfile(interaction.guildId!, target.id);
        const embed = new EmbedBuilder()
          .setTitle(`${target.username}'s Balance`)
          .setColor(0xf1c40f)
          .addFields(
            { name: 'Wallet', value: fmt(profile.wallet, settings.economyCurrencySymbol), inline: true },
            { name: 'Bank', value: fmt(profile.bank, settings.economyCurrencySymbol), inline: true },
            { name: 'Net Worth', value: fmt(profile.wallet + profile.bank, settings.economyCurrencySymbol), inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('daily').setDescription('Claim your daily reward'),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        const result = await economy.claimDaily(interaction.guildId!, interaction.user.id, settings);
        if (result.onCooldownMs) {
          const hours = Math.ceil(result.onCooldownMs / 3_600_000);
          await interaction.reply({ content: `⏳ You already claimed today's reward. Try again in ~${hours}h.`, ephemeral: true });
          return;
        }
        await interaction.reply(`💰 You claimed your daily reward: **${fmt(result.amount, settings.economyCurrencySymbol)}** (streak: ${result.streak} 🔥)`);
      }
    },
    {
      data: new SlashCommandBuilder().setName('work').setDescription('Work for coins'),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        const result = await economy.work(interaction.guildId!, interaction.user.id, settings);
        if (result.onCooldownMs) {
          const minutes = Math.ceil(result.onCooldownMs / 60_000);
          await interaction.reply({ content: `⏳ You're tired. Work again in ~${minutes}m.`, ephemeral: true });
          return;
        }
        await interaction.reply(`💼 You worked and earned **${fmt(result.amount, settings.economyCurrencySymbol)}**.`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to rob another member')
        .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true)),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        if (!settings.economyRobEnabled) {
          await interaction.reply({ content: 'Robbing is disabled on this server.', ephemeral: true });
          return;
        }
        const target = interaction.options.getUser('user', true);
        const result = await economy.rob(interaction.guildId!, interaction.user.id, target.id, settings);
        if (result.error === 'self') { await interaction.reply({ content: "You can't rob yourself.", ephemeral: true }); return; }
        if (result.error === 'too_poor') { await interaction.reply({ content: 'You need at least 50 coins in your wallet to attempt a robbery.', ephemeral: true }); return; }
        if (result.error === 'target_too_poor') { await interaction.reply({ content: `${target.username} is too poor to rob.`, ephemeral: true }); return; }
        if (result.onCooldownMs) { await interaction.reply({ content: `⏳ Lay low. Try robbing again in ~${Math.ceil(result.onCooldownMs / 60_000)}m.`, ephemeral: true }); return; }
        if (result.success) {
          await interaction.reply(`🦹 You robbed **${fmt(result.amount, settings.economyCurrencySymbol)}** from ${target}!`);
        } else {
          await interaction.reply(`🚨 You got caught robbing ${target} and paid a **${fmt(result.amount, settings.economyCurrencySymbol)}** fine.`);
        }
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Deposit, withdraw, or transfer coins')
        .addSubcommand((s) => s.setName('deposit').setDescription('Move coins to your bank').addIntegerOption((o) => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
        .addSubcommand((s) => s.setName('withdraw').setDescription('Move coins to your wallet').addIntegerOption((o) => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
        .addSubcommand((s) =>
          s
            .setName('transfer')
            .setDescription('Send coins to another member')
            .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
            .addIntegerOption((o) => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
        ),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        const sub = interaction.options.getSubcommand();
        const amount = interaction.options.getInteger('amount', true);

        if (sub === 'deposit') {
          const result = await economy.deposit(interaction.guildId!, interaction.user.id, amount);
          if (!result) { await interaction.reply({ content: 'Insufficient wallet balance.', ephemeral: true }); return; }
          await interaction.reply(`🏦 Deposited **${fmt(amount, settings.economyCurrencySymbol)}**.`);
        } else if (sub === 'withdraw') {
          const result = await economy.withdraw(interaction.guildId!, interaction.user.id, amount);
          if (!result) { await interaction.reply({ content: 'Insufficient bank balance.', ephemeral: true }); return; }
          await interaction.reply(`🏧 Withdrew **${fmt(amount, settings.economyCurrencySymbol)}**.`);
        } else {
          const target = interaction.options.getUser('user', true);
          const ok = await economy.transfer(interaction.guildId!, interaction.user.id, target.id, amount);
          if (!ok) { await interaction.reply({ content: "Transfer failed — check your balance and don't send to yourself.", ephemeral: true }); return; }
          await interaction.reply(`💸 Sent **${fmt(amount, settings.economyCurrencySymbol)}** to ${target}.`);
        }
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse and buy shop items')
        .addSubcommand((s) => s.setName('list').setDescription('List items for sale'))
        .addSubcommand((s) => s.setName('buy').setDescription('Buy an item').addStringOption((o) => o.setName('item_id').setDescription('Item ID from /shop list').setRequired(true)))
        .addSubcommand((s) => s.setName('inventory').setDescription('View your inventory')),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
          const items = await economy.listShopItems(interaction.guildId!);
          if (items.length === 0) { await interaction.reply('The shop is empty. Staff can add items from the dashboard.'); return; }
          const embed = new EmbedBuilder()
            .setTitle('🛒 Shop')
            .setColor(0x9b59b6)
            .setDescription(items.map((i) => `${i.emoji} **${i.name}** — ${fmt(i.price, settings.economyCurrencySymbol)}\n\`${i.id}\`${i.description ? ` — ${i.description}` : ''}`).join('\n\n'));
          await interaction.reply({ embeds: [embed] });
        } else if (sub === 'buy') {
          const itemId = interaction.options.getString('item_id', true);
          const result = await economy.buyItem(interaction.guildId!, interaction.user.id, itemId);
          if (!result.ok) { await interaction.reply({ content: result.error ?? 'Purchase failed.', ephemeral: true }); return; }
          if (result.item?.roleId) await interaction.guild!.members.cache.get(interaction.user.id)?.roles.add(result.item.roleId).catch(() => undefined);
          await interaction.reply(`✅ Purchased **${result.item?.name}**!`);
        } else {
          const inventory = await economy.getInventory(interaction.guildId!, interaction.user.id);
          if (inventory.length === 0) { await interaction.reply({ content: 'Your inventory is empty.', ephemeral: true }); return; }
          const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Inventory`)
            .setColor(0x9b59b6)
            .setDescription(inventory.map((i) => `${i.item.emoji} **${i.item.name}** x${i.quantity}`).join('\n'));
          await interaction.reply({ embeds: [embed] });
        }
      }
    },
    {
      data: new SlashCommandBuilder().setName('richest').setDescription('Server wealth leaderboard'),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        const top = await economy.getEconomyLeaderboard(interaction.guildId!, 10);
        if (top.length === 0) { await interaction.reply('No economy data yet.'); return; }
        const embed = new EmbedBuilder()
          .setTitle('💰 Richest Members')
          .setColor(0xf1c40f)
          .setDescription(top.map((p, i) => `**${i + 1}.** <@${p.userId}> — ${fmt(p.wallet + p.bank, settings.economyCurrencySymbol)}`).join('\n'));
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Bet on a coin flip')
        .addIntegerOption((o) => o.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))
        .addStringOption((o) => o.setName('side').setDescription('Your guess').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        const bet = interaction.options.getInteger('bet', true);
        const side = interaction.options.getString('side', true) as 'heads' | 'tails';
        const profile = await economy.getProfile(interaction.guildId!, interaction.user.id);
        if (profile.wallet < bet) { await interaction.reply({ content: 'Insufficient wallet balance.', ephemeral: true }); return; }

        const result = flipCoin();
        const won = result === side;
        await economy.addWallet(interaction.guildId!, interaction.user.id, won ? bet : -bet);
        await interaction.reply(
          `🪙 The coin landed on **${result}**! You ${won ? `won **${fmt(bet, settings.economyCurrencySymbol)}**` : `lost **${fmt(bet, settings.economyCurrencySymbol)}**`}.`
        );
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Spin the slot machine')
        .addIntegerOption((o) => o.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        const bet = interaction.options.getInteger('bet', true);
        const profile = await economy.getProfile(interaction.guildId!, interaction.user.id);
        if (profile.wallet < bet) { await interaction.reply({ content: 'Insufficient wallet balance.', ephemeral: true }); return; }

        const spin = spinSlots();
        const net = Math.round(bet * spin.multiplier) - bet;
        await economy.addWallet(interaction.guildId!, interaction.user.id, net);
        const line = spin.reels.join(' | ');
        await interaction.reply(
          spin.multiplier > 0
            ? `🎰 [ ${line} ] — You won **${fmt(Math.round(bet * spin.multiplier), settings.economyCurrencySymbol)}**!`
            : `🎰 [ ${line} ] — No match. You lost **${fmt(bet, settings.economyCurrencySymbol)}**.`
        );
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play a hand of blackjack against the dealer')
        .addIntegerOption((o) => o.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)),
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) return;
        const settings = await getGuildSettings(interaction.guildId!);
        const bet = interaction.options.getInteger('bet', true);
        const profile = await economy.getProfile(interaction.guildId!, interaction.user.id);
        if (profile.wallet < bet) { await interaction.reply({ content: 'Insufficient wallet balance.', ephemeral: true }); return; }

        const session = startBlackjack(bet);
        const naturalBlackjack = handValue(session.player) === 21;
        const reply = await interaction.reply({
          embeds: [blackjackEmbed(session, settings.economyCurrencySymbol, naturalBlackjack)],
          components: naturalBlackjack ? [] : [blackjackButtons()],
          fetchReply: true
        });

        if (naturalBlackjack) {
          const outcome = resolveDealerAndSettle(session);
          await economy.addWallet(interaction.guildId!, interaction.user.id, outcome.payout);
          await interaction.editReply({ content: `🂡 Blackjack! You won **${fmt(outcome.payout, settings.economyCurrencySymbol)}**.`, embeds: [blackjackEmbed(session, settings.economyCurrencySymbol, true)] });
          return;
        }

        blackjackSessions.set(reply.id, { session, userId: interaction.user.id, guildId: interaction.guildId!, symbol: settings.economyCurrencySymbol });
        setTimeout(() => blackjackSessions.delete(reply.id), 5 * 60_000);
      }
    }
  ],
  components: [
    {
      prefix: 'bj_',
      handleButton: async (interaction) => {
        const entry = blackjackSessions.get(interaction.message.id);
        if (!entry) {
          await interaction.reply({ content: 'This game has expired.', ephemeral: true });
          return;
        }
        if (interaction.user.id !== entry.userId) {
          await interaction.reply({ content: "This isn't your game.", ephemeral: true });
          return;
        }

        if (interaction.customId === 'bj_hit') {
          playerHit(entry.session);
          if (handValue(entry.session.player) > 21) {
            const outcome = resolveDealerAndSettle(entry.session);
            await economy.addWallet(entry.guildId, entry.userId, outcome.payout);
            blackjackSessions.delete(interaction.message.id);
            await interaction.update({ content: `💥 Bust! You lost **${fmt(entry.session.bet, entry.symbol)}**.`, embeds: [blackjackEmbed(entry.session, entry.symbol, true)], components: [] });
            return;
          }
          await interaction.update({ embeds: [blackjackEmbed(entry.session, entry.symbol, false)], components: [blackjackButtons()] });
          return;
        }

        // stand
        const outcome = resolveDealerAndSettle(entry.session);
        await economy.addWallet(entry.guildId, entry.userId, outcome.payout);
        blackjackSessions.delete(interaction.message.id);
        const resultText =
          outcome.result === 'dealer_bust'
            ? `🎉 Dealer busts! You won **${fmt(outcome.payout, entry.symbol)}**.`
            : outcome.result === 'player_win'
              ? `🎉 You win! **${fmt(outcome.payout, entry.symbol)}**.`
              : outcome.result === 'push'
                ? "🤝 It's a push — your bet is returned."
                : `😔 Dealer wins. You lost **${fmt(entry.session.bet, entry.symbol)}**.`;
        await interaction.update({ content: resultText, embeds: [blackjackEmbed(entry.session, entry.symbol, true)], components: [] });
      }
    }
  ]
};
