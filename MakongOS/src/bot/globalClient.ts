import type { Client } from 'discord.js';

declare global {
  // eslint-disable-next-line no-var
  var __makongosBotClient: Client | undefined;
}

export function setBotClient(client: Client): void {
  global.__makongosBotClient = client;
}

export function getBotClient(): Client | undefined {
  return global.__makongosBotClient;
}
