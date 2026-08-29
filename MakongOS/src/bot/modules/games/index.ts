import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  Events,
  type Message
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { checkWinner, TRIVIA_QUESTIONS, type Cell } from '../../../games/tictactoe';
import { recordGameResult, getLeaderboard } from '../../../games/stats';
import { getGuildSettings } from '../../../database/settingsCache';

interface TicTacToeGame {
  board: Cell[];
  turn: 'X' | 'O';
  playerX: string;
  playerO: string;
}
const ttGames = new Map<string, TicTacToeGame>();

interface RpsGame {
  p1: string;
  p2: string;
  choice1?: 'rock' | 'paper' | 'scissors';
  choice2?: 'rock' | 'paper' | 'scissors';
}
const rpsGames = new Map<string, RpsGame>();

interface TriviaGame {
  correctIndex: number;
  answered: Set<string>;
}
const triviaGames = new Map<string, TriviaGame>();

interface GuessGame {
  target: number;
  guildId: string;
  attempts: number;
}
const guessGames = new Map<string, GuessGame>();

function ttRow(board: Cell[], gameId: string, rowIndex: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    [0, 1, 2].map((col) => {
      const i = rowIndex * 3 + col;
      const cell = board[i];
      return new ButtonBuilder()
        .setCustomId(`tt_${gameId}_${i}`)
        .setLabel(cell ?? '​')
        .setStyle(cell === 'X' ? ButtonStyle.Danger : cell === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(cell !== null);
    })
  );
}

function rpsButtons(gameId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`rps_${gameId}_rock`).setLabel('🪨 Rock').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rps_${gameId}_paper`).setLabel('📄 Paper').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rps_${gameId}_scissors`).setLabel('✂️ Scissors').setStyle(ButtonStyle.Secondary)
  );
}

function rpsWinner(a: string, b: string): 'a' | 'b' | 'draw' {
  if (a === b) return 'draw';
  const beats: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  return beats[a] === b ? 'a' : 'b';
}

export const gamesModule: FeatureModule = {
  name: 'games',
  description: 'Multiplayer mini games: Tic Tac Toe, Rock Paper Scissors, Trivia, Guess the Number.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('Play a mini game.')
        .addSubcommand((sub) =>
          sub
            .setName('tictactoe')
            .setDescription('Challenge someone to Tic Tac Toe.')
            .addUserOption((o) => o.setName('opponent').setDescription('Who to challenge').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('rps')
            .setDescription('Challenge someone to Rock Paper Scissors.')
            .addUserOption((o) => o.setName('opponent').setDescription('Who to challenge').setRequired(true))
        )
        .addSubcommand((sub) => sub.setName('trivia').setDescription('Answer a Minecraft trivia question.'))
        .addSubcommand((sub) =>
          sub
            .setName('guessnumber')
            .setDescription('Start a guess-the-number game (1-100) in this channel.')
        )
        .addSubcommand((sub) => sub.setName('leaderboard').setDescription('Show the games leaderboard.')),
      module: 'games',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        if (!settings.gamesEnabled) {
          await interaction.reply({ content: '🚫 Games are disabled on this server.', flags: MessageFlags.Ephemeral });
          return;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'tictactoe') {
          const opponent = interaction.options.getUser('opponent', true);
          if (opponent.bot || opponent.id === interaction.user.id) {
            await interaction.reply({ content: 'Pick a real opponent to play against.', flags: MessageFlags.Ephemeral });
            return;
          }
          const board: Cell[] = Array(9).fill(null);
          const message = await interaction.reply({
            content: `❌ ${interaction.user} vs ⭕ ${opponent} — ${interaction.user}'s turn.`,
            components: [ttRow(board, 'pending', 0), ttRow(board, 'pending', 1), ttRow(board, 'pending', 2)],
            fetchReply: true
          });
          ttGames.set(message.id, { board, turn: 'X', playerX: interaction.user.id, playerO: opponent.id });
          await message.edit({
            components: [ttRow(board, message.id, 0), ttRow(board, message.id, 1), ttRow(board, message.id, 2)]
          });
          return;
        }

        if (sub === 'rps') {
          const opponent = interaction.options.getUser('opponent', true);
          if (opponent.bot || opponent.id === interaction.user.id) {
            await interaction.reply({ content: 'Pick a real opponent to play against.', flags: MessageFlags.Ephemeral });
            return;
          }
          const message = await interaction.reply({
            content: `🪨📄✂️ ${interaction.user} vs ${opponent} — both players pick secretly!`,
            components: [rpsButtons('pending')],
            fetchReply: true
          });
          rpsGames.set(message.id, { p1: interaction.user.id, p2: opponent.id });
          await message.edit({ components: [rpsButtons(message.id)] });
          return;
        }

        if (sub === 'trivia') {
          const q = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)]!;
          const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🧠 Minecraft Trivia').setDescription(q.question);
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            q.options.map((opt, i) => new ButtonBuilder().setCustomId(`trivia_pending_${i}`).setLabel(opt).setStyle(ButtonStyle.Secondary))
          );
          const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
          triviaGames.set(message.id, { correctIndex: q.correctIndex, answered: new Set() });
          const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            q.options.map((opt, i) => new ButtonBuilder().setCustomId(`trivia_${message.id}_${i}`).setLabel(opt).setStyle(ButtonStyle.Secondary))
          );
          await message.edit({ components: [row2] });
          return;
        }

        if (sub === 'guessnumber') {
          if (guessGames.has(interaction.channelId)) {
            await interaction.reply({ content: 'A guessing game is already running in this channel!', flags: MessageFlags.Ephemeral });
            return;
          }
          guessGames.set(interaction.channelId, { target: 1 + Math.floor(Math.random() * 100), guildId: interaction.guildId, attempts: 0 });
          await interaction.reply('🎯 I picked a number between **1 and 100**. Type your guesses in chat!');
          return;
        }

        if (sub === 'leaderboard') {
          const rows = await getLeaderboard(interaction.guildId);
          if (rows.length === 0) {
            await interaction.reply({ content: 'No games played yet.', flags: MessageFlags.Ephemeral });
            return;
          }
          const medals = ['🥇', '🥈', '🥉'];
          const description = rows
            .map((r, i) => `${medals[i] ?? `${i + 1}.`} <@${r.userId}> — ${r._sum.wins ?? 0} wins`)
            .join('\n');
          const embed = new EmbedBuilder().setColor(0xf0b232).setTitle('🏆 Games Leaderboard').setDescription(description);
          await interaction.reply({ embeds: [embed] });
        }
      }
    }
  ],
  components: [
    {
      prefix: 'tt_',
      button: async (interaction) => {
        const [, gameId, indexStr] = interaction.customId.split('_');
        const game = ttGames.get(gameId!);
        if (!game) return;
        const index = Number(indexStr);
        const expectedPlayer = game.turn === 'X' ? game.playerX : game.playerO;
        if (interaction.user.id !== expectedPlayer) {
          await interaction.reply({ content: "It's not your turn!", flags: MessageFlags.Ephemeral });
          return;
        }
        if (game.board[index] !== null) return;

        game.board[index] = game.turn;
        const winner = checkWinner(game.board);

        if (winner) {
          ttGames.delete(gameId!);
          if (winner === 'draw') {
            await recordGameResult(interaction.guildId!, game.playerX, 'tictactoe', 'draw');
            await recordGameResult(interaction.guildId!, game.playerO, 'tictactoe', 'draw');
          } else {
            const winnerId = winner === 'X' ? game.playerX : game.playerO;
            const loserId = winner === 'X' ? game.playerO : game.playerX;
            await recordGameResult(interaction.guildId!, winnerId, 'tictactoe', 'win');
            await recordGameResult(interaction.guildId!, loserId, 'tictactoe', 'loss');
          }
          await interaction.update({
            content: winner === 'draw' ? "🤝 It's a draw!" : `🏆 <@${winner === 'X' ? game.playerX : game.playerO}> wins!`,
            components: [ttRow(game.board, gameId!, 0), ttRow(game.board, gameId!, 1), ttRow(game.board, gameId!, 2)].map((row) => {
              row.components.forEach((c) => c.setDisabled(true));
              return row;
            })
          });
          return;
        }

        game.turn = game.turn === 'X' ? 'O' : 'X';
        const nextPlayer = game.turn === 'X' ? game.playerX : game.playerO;
        await interaction.update({
          content: `❌ <@${game.playerX}> vs ⭕ <@${game.playerO}> — <@${nextPlayer}>'s turn.`,
          components: [ttRow(game.board, gameId!, 0), ttRow(game.board, gameId!, 1), ttRow(game.board, gameId!, 2)]
        });
      }
    },
    {
      prefix: 'rps_',
      button: async (interaction) => {
        const [, gameId, choice] = interaction.customId.split('_') as [string, string, 'rock' | 'paper' | 'scissors'];
        const game = rpsGames.get(gameId);
        if (!game) return;
        if (interaction.user.id !== game.p1 && interaction.user.id !== game.p2) {
          await interaction.reply({ content: 'This is not your game!', flags: MessageFlags.Ephemeral });
          return;
        }
        if (interaction.user.id === game.p1) game.choice1 = choice;
        if (interaction.user.id === game.p2) game.choice2 = choice;

        await interaction.reply({ content: `You picked ${choice}.`, flags: MessageFlags.Ephemeral });

        if (game.choice1 && game.choice2) {
          rpsGames.delete(gameId);
          const result = rpsWinner(game.choice1, game.choice2);
          let content: string;
          if (result === 'draw') {
            content = `🤝 Both picked **${game.choice1}** — it's a draw!`;
            await recordGameResult(interaction.guildId!, game.p1, 'rps', 'draw');
            await recordGameResult(interaction.guildId!, game.p2, 'rps', 'draw');
          } else {
            const winnerId = result === 'a' ? game.p1 : game.p2;
            const loserId = result === 'a' ? game.p2 : game.p1;
            content = `🏆 <@${winnerId}> wins with **${result === 'a' ? game.choice1 : game.choice2}**!`;
            await recordGameResult(interaction.guildId!, winnerId, 'rps', 'win');
            await recordGameResult(interaction.guildId!, loserId, 'rps', 'loss');
          }
          await interaction.message.edit({ content, components: [] }).catch(() => undefined);
        }
      }
    },
    {
      prefix: 'trivia_',
      button: async (interaction) => {
        const [, gameId, indexStr] = interaction.customId.split('_');
        const game = triviaGames.get(gameId!);
        if (!game) return;
        if (game.answered.has(interaction.user.id)) {
          await interaction.reply({ content: 'You already answered.', flags: MessageFlags.Ephemeral });
          return;
        }
        game.answered.add(interaction.user.id);
        const correct = Number(indexStr) === game.correctIndex;
        if (correct) {
          triviaGames.delete(gameId!);
          await recordGameResult(interaction.guildId!, interaction.user.id, 'trivia', 'win');
          await interaction.update({ content: `✅ ${interaction.user} got it right!`, components: [], embeds: interaction.message.embeds });
        } else {
          await interaction.reply({ content: '❌ Not quite — try again!', flags: MessageFlags.Ephemeral });
        }
      }
    }
  ],
  events: [
    {
      event: Events.MessageCreate,
      handler: async (message: Message) => {
        if (message.author.bot || !message.guildId) return;
        const game = guessGames.get(message.channelId);
        if (!game) return;
        const guess = Number(message.content.trim());
        if (!Number.isInteger(guess)) return;

        game.attempts++;
        if (guess === game.target) {
          guessGames.delete(message.channelId);
          await recordGameResult(message.guildId, message.author.id, 'guessnumber', 'win');
          await message.reply(`🎉 Correct! The number was **${game.target}**. Solved in ${game.attempts} guesses.`);
        } else if (guess < game.target) {
          await message.reply('📈 Higher!').then((m) => setTimeout(() => m.delete().catch(() => undefined), 4000));
        } else {
          await message.reply('📉 Lower!').then((m) => setTimeout(() => m.delete().catch(() => undefined), 4000));
        }
      }
    }
  ]
};
