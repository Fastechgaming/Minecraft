import { SlashCommandBuilder, EmbedBuilder, type TextChannel, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, AudioPlayerStatus } from '@discordjs/voice';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { isDj } from '../../../services/permissions';
import { getQueue, setQueue, type GuildQueue } from '../../../music/queueManager';
import { resolveTracks, playNext, attachPlayerEvents, waitForConnection, stopQueue, refreshNowPlaying, restartCurrentTrack, nowPlayingEmbed, nowPlayingComponents, prepareMusicEngine } from '../../../music/player';
import type { FilterName } from '../../../music/filters';
import { withTimeout, TimeoutError } from '../../../services/timeout';

async function guardMusic(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const settings = await getGuildSettings(interaction.guildId!);
  if (!settings.musicEnabled) {
    await interaction.reply({ content: 'Music is disabled on this server.', ephemeral: true });
    return false;
  }
  const member = interaction.member as GuildMember;
  if (!isDj(member, settings)) {
    await interaction.reply({ content: 'You need a DJ role to control music.', ephemeral: true });
    return false;
  }
  return true;
}

export const musicModule: FeatureModule = {
  name: 'music',
  description: 'Queue-based music with a live Now Playing embed, buttons, and audio filters.',
  commands: [
    {
      data: new SlashCommandBuilder().setName('play').setDescription('Play a song from YouTube or Spotify').addStringOption((o) => o.setName('query').setDescription('URL or search terms').setRequired(true)),
      execute: async (interaction) => {
        if (!(await guardMusic(interaction))) return;
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
          await interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
          return;
        }
        await interaction.deferReply();

        const query = interaction.options.getString('query', true);
        let tracks: Awaited<ReturnType<typeof resolveTracks>>;
        try {
          tracks = await withTimeout(resolveTracks(query, interaction.user.id), 15_000, 'Search timed out');
        } catch (err) {
          if (err instanceof TimeoutError) {
            await interaction.editReply('❌ The search to YouTube/Spotify timed out. The server may be having trouble reaching those services right now — try again in a bit.');
          } else {
            await interaction.editReply('❌ Search failed — try a different query or link.');
          }
          return;
        }
        if (tracks.length === 0) {
          await interaction.editReply('❌ No results found.');
          return;
        }

        const settings = await getGuildSettings(interaction.guildId!);
        let queue = getQueue(interaction.guildId!);

        if (!queue || queue.destroyed) {
          const connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: interaction.guildId!, adapterCreator: interaction.guild!.voiceAdapterCreator, selfDeaf: true });
          await waitForConnection(connection).catch(() => undefined);
          const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
          connection.subscribe(player);
          queue = {
            guildId: interaction.guildId!,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channelId,
            connection,
            player,
            tracks: [],
            current: null,
            volume: settings.musicDefaultVol,
            filter: null,
            loop: 'off',
            nowPlayingMessageId: null,
            elapsedSec: 0,
            destroyed: false
          };
          setQueue(interaction.guildId!, queue);
          attachPlayerEvents(queue, interaction.channel as TextChannel);
        }

        if (queue.tracks.length + tracks.length > settings.musicMaxQueue) {
          await interaction.editReply('❌ Queue is full.');
          return;
        }

        queue.tracks.push(...tracks);
        if (!queue.current) {
          await playNext(queue, interaction.channel as TextChannel);
          await interaction.editReply(`🎶 Now playing **${tracks[0].title}**.`);
        } else {
          await interaction.editReply(`➕ Queued **${tracks[0].title}**.`);
        }
      }
    },
    {
      data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current track'),
      execute: async (interaction) => {
        if (!(await guardMusic(interaction))) return;
        const queue = getQueue(interaction.guildId!);
        if (!queue?.current) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        queue.player.stop(true);
        await interaction.reply('⏭️ Skipped.');
      }
    },
    {
      data: new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue'),
      execute: async (interaction) => {
        if (!(await guardMusic(interaction))) return;
        const queue = getQueue(interaction.guildId!);
        if (!queue) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        stopQueue(queue);
        await interaction.reply('⏹️ Stopped and left the voice channel.');
      }
    },
    {
      data: new SlashCommandBuilder().setName('queue').setDescription('View the music queue'),
      execute: async (interaction) => {
        const queue = getQueue(interaction.guildId!);
        if (!queue?.current) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🎶 Queue')
          .setColor(0x1db954)
          .setDescription(
            `**Now playing:** ${queue.current.title}\n\n` +
              (queue.tracks.length > 0 ? queue.tracks.slice(0, 15).map((t, i) => `${i + 1}. ${t.title}`).join('\n') : '*Queue is empty.*')
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('volume').setDescription('Set playback volume (0-200%)').addIntegerOption((o) => o.setName('percent').setDescription('0-200').setRequired(true).setMinValue(0).setMaxValue(200)),
      execute: async (interaction) => {
        if (!(await guardMusic(interaction))) return;
        const queue = getQueue(interaction.guildId!);
        if (!queue?.current) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        queue.volume = interaction.options.getInteger('percent', true);
        await interaction.reply(`🔊 Volume set to ${queue.volume}%. Restarting the current track to apply it...`);
        await restartCurrentTrack(queue, interaction.channel as TextChannel);
      }
    },
    {
      data: new SlashCommandBuilder().setName('loop').setDescription('Set loop mode').addStringOption((o) => o.setName('mode').setDescription('Loop mode').setRequired(true).addChoices({ name: 'Off', value: 'off' }, { name: 'Track', value: 'track' }, { name: 'Queue', value: 'queue' })),
      execute: async (interaction) => {
        if (!(await guardMusic(interaction))) return;
        const queue = getQueue(interaction.guildId!);
        if (!queue) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        queue.loop = interaction.options.getString('mode', true) as GuildQueue['loop'];
        await refreshNowPlaying(queue, interaction.channel as TextChannel);
        await interaction.reply(`🔁 Loop mode: **${queue.loop}**.`);
      }
    }
  ],
  components: [
    {
      prefix: 'music_',
      handleButton: async (interaction) => {
        const queue = getQueue(interaction.guildId!);
        if (!queue) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member as GuildMember;
        if (!isDj(member, settings)) {
          await interaction.reply({ content: 'You need a DJ role to control music.', ephemeral: true });
          return;
        }

        if (interaction.customId === 'music_pause') {
          if (queue.player.state.status === AudioPlayerStatus.Paused) queue.player.unpause();
          else queue.player.pause();
        } else if (interaction.customId === 'music_skip') {
          queue.player.stop(true);
        } else if (interaction.customId === 'music_stop') {
          stopQueue(queue);
          await interaction.update({ content: '⏹️ Stopped.', embeds: [], components: [] });
          return;
        } else if (interaction.customId === 'music_loop') {
          queue.loop = queue.loop === 'off' ? 'track' : queue.loop === 'track' ? 'queue' : 'off';
        }

        await interaction.update({ embeds: [nowPlayingEmbed(queue)], components: nowPlayingComponents(queue) });
      }
    },
    {
      prefix: 'music_filter_select',
      handleSelect: async (interaction) => {
        const queue = getQueue(interaction.guildId!);
        if (!queue) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member as GuildMember;
        if (!isDj(member, settings)) {
          await interaction.reply({ content: 'You need a DJ role to control music.', ephemeral: true });
          return;
        }
        const value = interaction.values[0];
        queue.filter = value === 'none' ? null : (value as FilterName);
        await interaction.deferUpdate();
        await restartCurrentTrack(queue, interaction.channel as TextChannel);
      }
    }
  ],
  events: {
    voiceStateUpdate: async (oldState, newState) => {
      const guildId = oldState.guild.id;
      const queue = getQueue(guildId);
      if (!queue || queue.destroyed) return;
      const voiceChannel = newState.guild.channels.cache.get(queue.voiceChannelId);
      if (voiceChannel?.isVoiceBased() && voiceChannel.members.filter((m) => !m.user.bot).size === 0) {
        stopQueue(queue);
      }
    }
  },
  onReady: () => prepareMusicEngine()
};
