import type { Client } from 'discord.js';

export interface RegisteredCommandInfo {
  name: string;
  description: string;
  module: string;
  defaultCooldownSec: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __makongosBotClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __makongosBotStartedAt: number | undefined;
  // eslint-disable-next-line no-var
  var __makongosCommandRegistry: RegisteredCommandInfo[] | undefined;
}

/**
 * The dashboard (bundled separately by Next) and the bot process share one
 * Node process but not necessarily one module cache, so the live Client
 * instance is published on `global` — the same trick used for the Prisma
 * client and the settings cache.
 */
export function publishBotClient(client: Client): void {
  global.__makongosBotClient = client;
  global.__makongosBotStartedAt = Date.now();
}

export function getBotClient(): Client | undefined {
  return global.__makongosBotClient;
}

export function getBotStartedAt(): number | undefined {
  return global.__makongosBotStartedAt;
}

export function publishCommandRegistry(list: RegisteredCommandInfo[]): void {
  global.__makongosCommandRegistry = list;
}

export function getCommandRegistry(): RegisteredCommandInfo[] {
  return global.__makongosCommandRegistry ?? [];
}
