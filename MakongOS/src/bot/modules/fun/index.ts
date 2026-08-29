import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { FeatureModule } from '../../../types/command';

const ROASTS = [
  "You're the reason the gene pool needs a lifeguard.",
  'You bring everyone so much joy... when you leave the room.',
  "I'd explain it to you, but I left my crayons at home.",
  'You have something on your chin... no, the third one down.',
  "You're not stupid; you just have bad luck thinking."
];

const COMPLIMENTS = [
  'You light up every server you join.',
  'Your builds are absolutely incredible.',
  "You're the kind of teammate everyone hopes to get.",
  'Your positivity is contagious.',
  'You make this community a better place.'
];

const FORTUNES = [
  'A rare drop is coming your way soon.',
  'Beware of creepers hiding in tall grass today.',
  'Your next trade will be surprisingly lucky.',
  'A new friendship will spawn where you least expect it.',
  'Patience will net you the diamonds you seek.'
];

function hashPair(a: string, b: string): number {
  const combined = [a, b].sort().join('-');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
  return hash % 101;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pairEmbed(title: string, a: string, b: string, percent: number, footer: string) {
  const bar = '█'.repeat(Math.round(percent / 10)) + '░'.repeat(10 - Math.round(percent / 10));
  return new EmbedBuilder()
    .setColor(0xda6bf2)
    .setTitle(title)
    .setDescription(`${a} + ${b}\n\n\`${bar}\` **${percent}%**`)
    .setFooter({ text: footer });
}

export const funModule: FeatureModule = {
  name: 'fun',
  description: 'Lighthearted social commands — clearly for entertainment, not real judgments about anyone.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Ship two members together (just for fun).')
        .addUserOption((o) => o.setName('user1').setDescription('First user').setRequired(true))
        .addUserOption((o) => o.setName('user2').setDescription('Second user').setRequired(true)),
      module: 'fun',
      execute: async (interaction) => {
        const u1 = interaction.options.getUser('user1', true);
        const u2 = interaction.options.getUser('user2', true);
        const percent = hashPair(u1.id, u2.id);
        await interaction.reply({ embeds: [pairEmbed('💘 Ship Calculator', u1.toString(), u2.toString(), percent, 'Purely random and just for fun 😄')] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('compatibility')
        .setDescription('Fictional compatibility detector between two members.')
        .addUserOption((o) => o.setName('user1').setDescription('First user').setRequired(true))
        .addUserOption((o) => o.setName('user2').setDescription('Second user').setRequired(true)),
      module: 'fun',
      execute: async (interaction) => {
        const u1 = interaction.options.getUser('user1', true);
        const u2 = interaction.options.getUser('user2', true);
        const percent = hashPair(u1.id + 'c', u2.id + 'c');
        await interaction.reply({ embeds: [pairEmbed('💗 Compatibility Detector', u1.toString(), u2.toString(), percent, 'This is just for fun, not a real assessment of anyone 😭')] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('friendship')
        .setDescription('Fictional friendship meter between two members.')
        .addUserOption((o) => o.setName('user1').setDescription('First user').setRequired(true))
        .addUserOption((o) => o.setName('user2').setDescription('Second user').setRequired(true)),
      module: 'fun',
      execute: async (interaction) => {
        const u1 = interaction.options.getUser('user1', true);
        const u2 = interaction.options.getUser('user2', true);
        const percent = hashPair(u1.id + 'f', u2.id + 'f');
        await interaction.reply({ embeds: [pairEmbed('🤝 Friendship Meter', u1.toString(), u2.toString(), percent, 'A silly random number, nothing more!')] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('loyalty')
        .setDescription("Fictional loyalty detector (just for laughs).")
        .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(true)),
      module: 'fun',
      execute: async (interaction) => {
        const u = interaction.options.getUser('user', true);
        const percent = hashPair(u.id, 'loyalty-salt');
        await interaction.reply({ embeds: [pairEmbed('🛡️ Loyalty Detector', u.toString(), 'this server', percent, 'A random entertainment mechanic, not a real claim about anyone.')] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('roast').setDescription('Playfully roast someone.').addUserOption((o) => o.setName('user').setDescription('User to roast').setRequired(true)),
      module: 'fun',
      execute: async (interaction) => {
        const user = interaction.options.getUser('user', true);
        await interaction.reply(`🔥 ${user}, ${pick(ROASTS)}`);
      }
    },
    {
      data: new SlashCommandBuilder().setName('compliment').setDescription('Send someone a compliment.').addUserOption((o) => o.setName('user').setDescription('User to compliment').setRequired(true)),
      module: 'fun',
      execute: async (interaction) => {
        const user = interaction.options.getUser('user', true);
        await interaction.reply(`✨ ${user}, ${pick(COMPLIMENTS)}`);
      }
    },
    {
      data: new SlashCommandBuilder().setName('fortune').setDescription('Get your Minecraft fortune for today.'),
      module: 'fun',
      execute: async (interaction) => {
        await interaction.reply(`🔮 ${pick(FORTUNES)}`);
      }
    },
    {
      data: new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball a question.').addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true)),
      module: 'fun',
      execute: async (interaction) => {
        const answers = ['Yes.', 'No.', 'Absolutely!', 'Ask again later.', 'Very doubtful.', 'It is certain.', 'Cannot predict now.'];
        await interaction.reply(`🎱 ${pick(answers)}`);
      }
    },
    {
      data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin.'),
      module: 'fun',
      execute: async (interaction) => {
        await interaction.reply(Math.random() < 0.5 ? '🪙 Heads!' : '🪙 Tails!');
      }
    },
    {
      data: new SlashCommandBuilder().setName('dice').setDescription('Roll a dice.').addIntegerOption((o) => o.setName('sides').setDescription('Number of sides (default 6)').setMinValue(2).setMaxValue(100)),
      module: 'fun',
      execute: async (interaction) => {
        const sides = interaction.options.getInteger('sides') ?? 6;
        const roll = 1 + Math.floor(Math.random() * sides);
        await interaction.reply(`🎲 You rolled a **${roll}** (d${sides}).`);
      }
    }
  ]
};
