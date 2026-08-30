import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';

const ANIMALS = ['cat', 'dog', 'panda', 'fox', 'red_panda', 'koala', 'bird', 'raccoon', 'kangaroo'];
const MEME_SUBREDDITS = ['memes', 'dankmemes', 'wholesomememes', 'ProgrammerHumor'];
const REACTIONS = ['hug', 'pat', 'slap', 'kiss', 'cuddle', 'poke', 'tickle', 'cry', 'dance', 'feed', 'highfive', 'wink'] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MakongOS-Discord-Bot' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function guardEnabled(interaction: { guildId: string | null }): Promise<boolean> {
  if (!interaction.guildId) return true;
  const settings = await getGuildSettings(interaction.guildId);
  return settings.funEnabled;
}

async function buildMemeEmbed(subreddit?: string) {
  const choice = subreddit ?? pick(MEME_SUBREDDITS);
  const data = await fetchJson<{ title: string; url: string; postLink: string; subreddit: string; ups: number; author: string; nsfw: boolean }>(
    `https://meme-api.com/gimme/${choice}`
  );
  if (!data || data.nsfw) return null;

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(data.title.slice(0, 256))
    .setURL(data.postLink)
    .setImage(data.url)
    .setFooter({ text: `👍 ${data.ups} · r/${data.subreddit} · u/${data.author}` });
}

export const funModule: FeatureModule = {
  name: 'fun',
  description: 'Coinflip, dice, 8ball, memes, animal facts, and anime reaction gifs.',
  commands: [
    {
      data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin.'),
      module: 'fun',
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) {
          await interaction.reply({ content: '🚫 Fun commands are disabled here.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.reply(Math.random() < 0.5 ? '🪙 Heads!' : '🪙 Tails!');
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll a dice.')
        .addIntegerOption((o) => o.setName('sides').setDescription('Number of sides (default 6)').setMinValue(2).setMaxValue(100)),
      module: 'fun',
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) {
          await interaction.reply({ content: '🚫 Fun commands are disabled here.', flags: MessageFlags.Ephemeral });
          return;
        }
        const sides = interaction.options.getInteger('sides') ?? 6;
        const roll = 1 + Math.floor(Math.random() * sides);
        await interaction.reply(`🎲 You rolled a **${roll}** (d${sides}).`);
      }
    },
    {
      data: new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball a question.').addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true)),
      module: 'fun',
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) {
          await interaction.reply({ content: '🚫 Fun commands are disabled here.', flags: MessageFlags.Ephemeral });
          return;
        }
        const answers = ['Yes.', 'No.', 'Absolutely!', 'Ask again later.', 'Very doubtful.', 'It is certain.', 'Cannot predict now.'];
        await interaction.reply(`🎱 ${pick(answers)}`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Get a random meme.')
        .addStringOption((o) => o.setName('subreddit').setDescription('Subreddit to pull from')),
      module: 'fun',
      defaultCooldownSec: 10,
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) {
          await interaction.reply({ content: '🚫 Fun commands are disabled here.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.deferReply();
        const subreddit = interaction.options.getString('subreddit')?.replace(/\W/g, '') || undefined;
        const embed = await buildMemeEmbed(subreddit);
        if (!embed) {
          await interaction.editReply('❌ Could not fetch a meme right now — try again in a bit.');
          return;
        }
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`fun_meme_regen_${subreddit ?? ''}`).setEmoji('🔁').setLabel('Another').setStyle(ButtonStyle.Secondary)
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('facts')
        .setDescription('Get a random animal fact.')
        .addStringOption((o) => o.setName('animal').setDescription('Animal').setRequired(true).addChoices(...ANIMALS.map((a) => ({ name: a, value: a })))),
      module: 'fun',
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) {
          await interaction.reply({ content: '🚫 Fun commands are disabled here.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.deferReply();
        const animal = interaction.options.getString('animal', true);
        const data = await fetchJson<{ fact: string; image: string }>(`https://some-random-api.com/animal/${animal}`);
        if (!data) {
          await interaction.editReply('❌ Could not fetch a fact right now — try again in a bit.');
          return;
        }
        const embed = new EmbedBuilder().setColor(0x23a559).setTitle(`Did you know? (${animal})`).setDescription(data.fact).setImage(data.image);
        await interaction.editReply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('react')
        .setDescription('Send an anime reaction gif.')
        .addStringOption((o) => o.setName('type').setDescription('Reaction type').setRequired(true).addChoices(...REACTIONS.map((r) => ({ name: r, value: r }))))
        .addUserOption((o) => o.setName('user').setDescription('Who to react to')),
      module: 'fun',
      execute: async (interaction) => {
        if (!(await guardEnabled(interaction))) {
          await interaction.reply({ content: '🚫 Fun commands are disabled here.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.deferReply();
        const type = interaction.options.getString('type', true) as (typeof REACTIONS)[number];
        const target = interaction.options.getUser('user');
        const data = await fetchJson<{ results: { url: string; anime_name?: string }[] }>(`https://nekos.best/api/v2/${type}`);
        const result = data?.results?.[0];
        if (!result) {
          await interaction.editReply('❌ Could not fetch a reaction gif right now — try again in a bit.');
          return;
        }
        const verb = type.charAt(0).toUpperCase() + type.slice(1);
        const description = target ? `${interaction.user} ${type}s ${target}!` : `${interaction.user} ${type}s!`;
        const embed = new EmbedBuilder().setColor(0xda6bf2).setTitle(`${verb}!`).setDescription(description).setImage(result.url);
        if (result.anime_name) embed.setFooter({ text: `From: ${result.anime_name}` });
        await interaction.editReply({ embeds: [embed] });
      }
    }
  ],
  components: [
    {
      prefix: 'fun_meme_regen_',
      button: async (interaction) => {
        await interaction.deferUpdate();
        const subreddit = interaction.customId.replace('fun_meme_regen_', '') || undefined;
        const embed = await buildMemeEmbed(subreddit);
        if (!embed) return;
        await interaction.editReply({ embeds: [embed] });
      }
    }
  ]
};
