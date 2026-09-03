import {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type GuildMember
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { isDj } from '../../../services/permissions';
import { withTimeout, TimeoutError } from '../../../services/timeout';
import {
  applyFilter,
  searchTrack,
  nowPlayingEmbed,
  nowPlayingComponents,
  refreshNowPlaying,
  replayCurrent,
  playPrevious,
  clearQueue,
  toggleAutoplay,
  stopAndClearNowPlaying,
  scheduleEmptyChannelLeave,
  clearEmptyChannelTimer,
  type FilterName
} from '../../../music/lavalink';

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
  description: 'Queue-based music (powered by Lavalink) with a live Now Playing embed, buttons, and audio filters.',
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
        await interaction.deferReply({ ephemeral: true });

        const settings = await getGuildSettings(interaction.guildId!);
        const client = interaction.client;
        const player =
          client.lavalink.getPlayer(interaction.guildId!) ??
          client.lavalink.createPlayer({
            guildId: interaction.guildId!,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channelId,
            volume: settings.musicDefaultVol,
            selfDeaf: true
          });
        if (!player.connected) {
          await player.connect();
        }
        clearEmptyChannelTimer(interaction.guildId!);

        const query = interaction.options.getString('query', true);
        let result: Awaited<ReturnType<typeof searchTrack>>;
        try {
          result = await withTimeout(searchTrack(player, query, interaction.user.id), 15_000, 'Search timed out');
        } catch (err) {
          if (err instanceof TimeoutError) {
            await interaction.editReply('❌ The search to YouTube/Spotify timed out. The Lavalink server may be having trouble reaching those services right now — try again in a bit.');
          } else {
            await interaction.editReply('❌ Search failed — try a different query or link.');
          }
          if (!player.queue.current && player.queue.tracks.length === 0) await player.destroy().catch(() => undefined);
          return;
        }

        if (result.loadType === 'error' || result.loadType === 'empty' || result.tracks.length === 0) {
          await interaction.editReply('❌ No results found.');
          if (!player.queue.current && player.queue.tracks.length === 0) await player.destroy().catch(() => undefined);
          return;
        }

        const isPlaylist = result.loadType === 'playlist';
        const tracksToAdd = isPlaylist ? result.tracks : [result.tracks[0]];
        const remaining = settings.musicMaxQueue - player.queue.tracks.length - (player.queue.current ? 1 : 0);
        if (remaining <= 0) {
          await interaction.editReply('❌ Queue is full.');
          return;
        }
        const toQueue = tracksToAdd.slice(0, remaining);

        const hadCurrent = !!player.queue.current;
        await player.queue.add(toQueue);
        if (!hadCurrent) await player.play();

        // The persistent Now Playing embed (posted on the "trackStart" event) is the
        // visible confirmation — this ack is ephemeral so it doesn't also clutter the
        // channel with a second message for the same thing.
        await interaction.editReply(isPlaylist ? `✅ Added ${toQueue.length} tracks.` : `✅ Added **${toQueue[0].info.title}**.`);
      }
    },
    {
      data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current track'),
      execute: async (interaction) => {
        if (!(await guardMusic(interaction))) return;
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);
        if (!player?.queue.current) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        await player.skip();
        await interaction.reply({ content: '⏭️ Skipped.', ephemeral: true });
      }
    },
    {
      data: new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue'),
      execute: async (interaction) => {
        if (!(await guardMusic(interaction))) return;
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);
        if (!player) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        await stopAndClearNowPlaying(interaction.client, player);
        await interaction.reply({ content: '⏹️ Stopped and left the voice channel.', ephemeral: true });
      }
    },
    {
      data: new SlashCommandBuilder().setName('volume').setDescription('Set playback volume (0-200%)').addIntegerOption((o) => o.setName('percent').setDescription('0-200').setRequired(true).setMinValue(0).setMaxValue(200)),
      execute: async (interaction) => {
        if (!(await guardMusic(interaction))) return;
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);
        if (!player?.queue.current) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        const percent = interaction.options.getInteger('percent', true);
        await player.setVolume(percent);
        await refreshNowPlaying(interaction.client, player);
        await interaction.reply({ content: `🔊 Volume set to ${percent}%.`, ephemeral: true });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Set loop mode')
        .addStringOption((o) => o.setName('mode').setDescription('Loop mode').setRequired(true).addChoices({ name: 'Off', value: 'off' }, { name: 'Track', value: 'track' }, { name: 'Queue', value: 'queue' })),
      execute: async (interaction) => {
        if (!(await guardMusic(interaction))) return;
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);
        if (!player) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        const mode = interaction.options.getString('mode', true) as 'off' | 'track' | 'queue';
        await player.setRepeatMode(mode);
        await refreshNowPlaying(interaction.client, player);
        await interaction.reply({ content: `🔁 Loop mode: **${mode}**.`, ephemeral: true });
      }
    },
    {
      data: new SlashCommandBuilder().setName('queue').setDescription('View the music queue'),
      execute: async (interaction) => {
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);
        if (!player?.queue.current) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🎶 Queue')
          .setColor(0x22c55e)
          .setDescription(
            `**Now playing:** ${player.queue.current.info.title}\n\n` +
              (player.queue.tracks.length > 0
                ? player.queue.tracks.slice(0, 15).map((t, i) => `${i + 1}. ${t.info.title}`).join('\n')
                : '*Queue is empty.*')
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  ],
  components: [
    // Checked before the generic "music_" prefix below so a select-menu/modal customId
    // (which also starts with "music_") doesn't get swallowed by the button handler.
    {
      prefix: 'music_filter_select',
      handleSelect: async (interaction) => {
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);
        if (!player) {
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
        await applyFilter(player, value === 'none' ? null : (value as FilterName));
        await interaction.update({ embeds: [nowPlayingEmbed(player)], components: nowPlayingComponents(player) });
      }
    },
    {
      prefix: 'music_volume_modal',
      handleModal: async (interaction) => {
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);
        if (!player) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        const raw = interaction.fields.getTextInputValue('amount');
        const percent = Number(raw);
        if (!Number.isInteger(percent) || percent < 0 || percent > 200) {
          await interaction.reply({ content: '❌ Enter a whole number between 0 and 200.', ephemeral: true });
          return;
        }
        await player.setVolume(percent);
        if (interaction.isFromMessage()) {
          await interaction.update({ embeds: [nowPlayingEmbed(player)], components: nowPlayingComponents(player) });
        } else {
          await refreshNowPlaying(interaction.client, player);
          await interaction.reply({ content: `🔊 Volume set to ${percent}%.`, ephemeral: true });
        }
      }
    },
    {
      prefix: 'music_',
      handleButton: async (interaction) => {
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);
        if (!player) {
          await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
          return;
        }
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member as GuildMember;
        if (!isDj(member, settings)) {
          await interaction.reply({ content: 'You need a DJ role to control music.', ephemeral: true });
          return;
        }

        switch (interaction.customId) {
          case 'music_playpause':
            if (player.paused) await player.resume();
            else await player.pause();
            break;
          case 'music_replay': {
            const ok = await replayCurrent(player);
            if (!ok) {
              await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
              return;
            }
            break;
          }
          case 'music_previous': {
            const ok = await playPrevious(player);
            if (!ok) {
              await interaction.reply({ content: 'No previous track.', ephemeral: true });
              return;
            }
            break;
          }
          case 'music_skip':
            if (!player.queue.current) {
              await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
              return;
            }
            await player.skip();
            break;
          case 'music_clear':
            await clearQueue(player);
            break;
          case 'music_autoplay':
            toggleAutoplay(player);
            break;
          case 'music_volume': {
            const modal = new ModalBuilder().setCustomId('music_volume_modal').setTitle('Set Volume');
            const input = new TextInputBuilder()
              .setCustomId('amount')
              .setLabel('Volume (0-200)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(String(player.volume))
              .setRequired(true)
              .setMaxLength(3);
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
            await interaction.showModal(modal);
            return;
          }
          case 'music_stop':
            await stopAndClearNowPlaying(interaction.client, player);
            await interaction.deferUpdate();
            return;
          case 'music_shuffle':
            await player.queue.shuffle();
            break;
          case 'music_loop': {
            const next = player.repeatMode === 'off' ? 'track' : player.repeatMode === 'track' ? 'queue' : 'off';
            await player.setRepeatMode(next);
            break;
          }
        }

        await interaction.update({ embeds: [nowPlayingEmbed(player)], components: nowPlayingComponents(player) });
      }
    }
  ],
  events: {
    voiceStateUpdate: async (oldState, newState) => {
      const client = oldState.client;
      const player = client.lavalink.getPlayer(oldState.guild.id);
      if (!player?.voiceChannelId) return;
      const voiceChannel = newState.guild.channels.cache.get(player.voiceChannelId);
      if (!voiceChannel?.isVoiceBased()) return;

      if (voiceChannel.members.filter((m) => !m.user.bot).size === 0) {
        scheduleEmptyChannelLeave(client, player, `#${voiceChannel.name}`);
      } else {
        clearEmptyChannelTimer(player.guildId);
      }
    }
  }
};
