import type { Client } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma';
import { createLogger } from '../services/logger';

const log = createLogger('social-alerts');

let twitchToken: { token: string; expiresAt: number } | null = null;
async function getTwitchToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (twitchToken && twitchToken.expiresAt > Date.now()) return twitchToken.token;

  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, { method: 'POST' });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  twitchToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return twitchToken.token;
}

async function checkTwitchLive(login: string): Promise<{ id: string; title: string; url: string } | null> {
  const token = await getTwitchToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!token || !clientId) return null;

  const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId }
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data: { id: string; title: string }[] };
  const stream = data.data[0];
  if (!stream) return null;
  return { id: stream.id, title: stream.title, url: `https://twitch.tv/${login}` };
}

async function checkYoutubeUpload(channelId: string): Promise<{ id: string; title: string; url: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&order=date&part=snippet&type=video&maxResults=1&key=${apiKey}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { items: { id: { videoId: string }; snippet: { title: string } }[] };
  const item = data.items[0];
  if (!item) return null;
  return { id: item.id.videoId, title: item.snippet.title, url: `https://youtube.com/watch?v=${item.id.videoId}` };
}

export async function pollAllAlerts(client: Client): Promise<void> {
  const alerts = await prisma.socialAlert.findMany();
  for (const alert of alerts) {
    try {
      const result = alert.platform === 'twitch' ? await checkTwitchLive(alert.channelHandle) : await checkYoutubeUpload(alert.channelHandle);
      if (!result || result.id === alert.lastSeenId) continue;

      const channel = await client.channels.fetch(alert.announceChannelId).catch(() => null);
      if (channel?.isTextBased() && 'send' in channel) {
        const embed = new EmbedBuilder()
          .setTitle(result.title)
          .setURL(result.url)
          .setColor(alert.platform === 'twitch' ? 0x9146ff : 0xff0000)
          .setDescription(alert.message.replace('{creator}', alert.channelHandle).replace('{url}', result.url));
        await channel.send({ embeds: [embed] }).catch(() => undefined);
      }
      await prisma.socialAlert.update({ where: { id: alert.id }, data: { lastSeenId: result.id } });
    } catch (err) {
      log.warn(`Alert check failed for ${alert.platform}:${alert.channelHandle}`, err);
    }
  }
}
