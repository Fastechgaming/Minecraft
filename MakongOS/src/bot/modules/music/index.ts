import { SlashCommandBuilder, EmbedBuilder, MessageFlags, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { isDJ } from '../../../services/permissions';
import { playDlProvider } from '../../../providers/music/playDlProvider';
import {
  joinAndGetState,
  enqueue,
  togglePause,
  skip,
  shuffleQueue,
  cycleLoop,
  stopAndLeave,
  buildNowPlayingEmbed,
  buildControlRow
} from '../../../music/player';
import { getMusicState } from '../../../music/queueManager';

async function guard(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guildId) return false;
  const settings = await getGuildSettings(interaction.guildId);
  if (!settings.musicEnabled) {
    await interaction.reply({ content: '🚫 Music is disabled on this server.', flags: MessageFlags.Ephemeral });
    return false;
  }
  if (settings.musicChannelIds.length > 0 && !settings.musicChannelIds.includes(interaction.channelId)) {
    await interaction.reply({ content: '🚫 Music commands are not allowed in this channel.', flags: MessageFlags.Ephemeral });
    return false;
  }
  if (!isDJ(interaction.member as GuildMember, settings)) {
    await interaction.reply({ content: '🚫 You need the DJ role to control music.', flags: MessageFlags.Ephemeral });
    return false;
  }
  return true;
}

export const musicModule: FeatureModule = {
  name: 'music',
  description: 'Queue-based music player with a live Now Playing embed and playback buttons.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or add it to the queue.')
        .addStringOption((o) => o.setName('query').setDescription('Song name or URL').setRequired(true)),
      module: 'music',
      execute: async (interaction) => {
        if (!(await guard(interaction))) return;
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
          await interaction.reply({ content: '🔊 Join a voice channel first.', flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.deferReply();
        const query = interaction.options.getString('query', true);
        const settings = await getGuildSettings(interaction.guildId!);

        const state = await joinAndGetState(interaction.guildId!, voiceChannel, interaction.channel!);
        if (state.queue.length >= settings.musicMaxQueue) {
          await interaction.editReply(`🚫 Queue is full (max ${settings.musicMaxQueue}).`);
          return;
        }
        state.volume = settings.musicDefaultVol;

        const results = await playDlProvider.search(query);
        if (results.length === 0) {
          await interaction.editReply('❌ No results found.');
          return;
        }
        const track = { ...results[0]!, requestedById: interaction.user.id };
        await enqueue(state, [track]);

        const embed = new EmbedBuilder()
          .setColor(0x23a559)
          .setDescription(`✅ Queued **[${track.title}](${track.url})**`)
          .setThumbnail(track.thumbnail ?? null);
        await interaction.editReply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current song.'),
      module: 'music',
      execute: async (interaction) => {
        if (!(await guard(interaction))) return;
        const state = getMusicState(interaction.guildId!);
        if (!state?.current) {
          await interaction.reply({ content: 'Nothing is playing.', flags: MessageFlags.Ephemeral });
          return;
        }
        skip(state);
        await interaction.reply('⏭️ Skipped.');
      }
    },
    {
      data: new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue.'),
      module: 'music',
      execute: async (interaction) => {
        if (!(await guard(interaction))) return;
        await stopAndLeave(interaction.guildId!);
        await interaction.reply('⏹️ Stopped and left the voice channel.');
      }
    },
    {
      data: new SlashCommandBuilder().setName('pause').setDescription('Pause the current song.'),
      module: 'music',
      execute: async (interaction) => {
        if (!(await guard(interaction))) return;
        const state = getMusicState(interaction.guildId!);
        if (!state?.current) {
          await interaction.reply({ content: 'Nothing is playing.', flags: MessageFlags.Ephemeral });
          return;
        }
        togglePause(state);
        await interaction.reply('⏸️ Paused.');
      }
    },
    {
      data: new SlashCommandBuilder().setName('resume').setDescription('Resume playback.'),
      module: 'music',
      execute: async (interaction) => {
        if (!(await guard(interaction))) return;
        const state = getMusicState(interaction.guildId!);
        if (!state?.current) {
          await interaction.reply({ content: 'Nothing is playing.', flags: MessageFlags.Ephemeral });
          return;
        }
        togglePause(state);
        await interaction.reply('▶️ Resumed.');
      }
    },
    {
      data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue.'),
      module: 'music',
      execute: async (interaction) => {
        if (!(await guard(interaction))) return;
        const state = getMusicState(interaction.guildId!);
        if (!state) {
          await interaction.reply({ content: 'Nothing is queued.', flags: MessageFlags.Ephemeral });
          return;
        }
        shuffleQueue(state);
        await interaction.reply('🔀 Queue shuffled.');
      }
    },
    {
      data: new SlashCommandBuilder().setName('loop').setDescription('Cycle loop mode: off → queue → track.'),
      module: 'music',
      execute: async (interaction) => {
        if (!(await guard(interaction))) return;
        const state = getMusicState(interaction.guildId!);
        if (!state) {
          await interaction.reply({ content: 'Nothing is playing.', flags: MessageFlags.Ephemeral });
          return;
        }
        cycleLoop(state);
        await interaction.reply(`🔁 Loop mode: **${state.loop}**`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set playback volume (0-100).')
        .addIntegerOption((o) => o.setName('level').setDescription('Volume').setRequired(true).setMinValue(0).setMaxValue(100)),
      module: 'music',
      execute: async (interaction) => {
        if (!(await guard(interaction))) return;
        const state = getMusicState(interaction.guildId!);
        if (!state) {
          await interaction.reply({ content: 'Nothing is playing.', flags: MessageFlags.Ephemeral });
          return;
        }
        state.volume = interaction.options.getInteger('level', true);
        await interaction.reply(`🔊 Volume set to ${state.volume}%.`);
      }
    },
    {
      data: new SlashCommandBuilder().setName('queue').setDescription('Show the current queue.'),
      module: 'music',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const state = getMusicState(interaction.guildId);
        if (!state || (!state.current && state.queue.length === 0)) {
          await interaction.reply({ content: 'The queue is empty.', flags: MessageFlags.Ephemeral });
          return;
        }
        const upcoming = state.queue
          .slice(0, 10)
          .map((t, i) => `${i + 1}. **${t.title}** — <@${t.requestedById}>`)
          .join('\n');
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🎵 Queue')
          .setDescription(
            `**Now Playing:** ${state.current ? `[${state.current.title}](${state.current.url})` : 'Nothing'}\n\n${upcoming || '*Queue is empty*'}`
          )
          .setFooter({ text: `${state.queue.length} song(s) queued` });
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show the Now Playing panel again.'),
      module: 'music',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const state = getMusicState(interaction.guildId);
        if (!state?.current) {
          await interaction.reply({ content: 'Nothing is playing.', flags: MessageFlags.Ephemeral });
          return;
        }
        const message = await interaction.reply({ embeds: [buildNowPlayingEmbed(state)], components: [buildControlRow(state)], fetchReply: true });
        state.nowPlayingMessageId = message.id;
      }
    }
  ],
  components: [
    {
      prefix: 'music_playpause',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        const state = getMusicState(interaction.guildId);
        if (!state?.current) {
          await interaction.reply({ content: 'Nothing is playing.', flags: MessageFlags.Ephemeral });
          return;
        }
        togglePause(state);
        await interaction.update({ embeds: [buildNowPlayingEmbed(state)], components: [buildControlRow(state)] });
      }
    },
    {
      prefix: 'music_skip',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        const state = getMusicState(interaction.guildId);
        if (!state?.current) {
          await interaction.reply({ content: 'Nothing is playing.', flags: MessageFlags.Ephemeral });
          return;
        }
        skip(state);
        await interaction.reply({ content: '⏭️ Skipped.', flags: MessageFlags.Ephemeral });
      }
    },
    {
      prefix: 'music_stop',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        await stopAndLeave(interaction.guildId);
        await interaction.update({ content: '⏹️ Stopped.', embeds: [], components: [] });
      }
    },
    {
      prefix: 'music_shuffle',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        const state = getMusicState(interaction.guildId);
        if (!state) return;
        shuffleQueue(state);
        await interaction.reply({ content: '🔀 Queue shuffled.', flags: MessageFlags.Ephemeral });
      }
    },
    {
      prefix: 'music_loop',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        const state = getMusicState(interaction.guildId);
        if (!state) return;
        cycleLoop(state);
        await interaction.update({ embeds: [buildNowPlayingEmbed(state)], components: [buildControlRow(state)] });
      }
    }
  ]
};
