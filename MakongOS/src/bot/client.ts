import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import type { ChatInputCommandInteraction, ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import type { LavalinkManager } from 'lavalink-client';
import { modules } from './registry';
import { registerCommandsForGuilds, registerCommandsForGuild } from './registerCommands';
import { setBotClient } from './globalClient';
import { prisma } from '../database/prisma';
import { createLogger } from '../services/logger';
import { createLavalinkManager } from '../music/lavalink';
import type { SlashCommand, ComponentHandler } from '../types/command';

declare module 'discord.js' {
  interface Client {
    lavalink: LavalinkManager;
  }
}

const log = createLogger('bot');

function buildCommandMap(): Map<string, { command: SlashCommand; module: string }> {
  const map = new Map<string, { command: SlashCommand; module: string }>();
  for (const mod of modules) {
    for (const command of mod.commands ?? []) {
      const name = command.data.name;
      if (map.has(name)) {
        throw new Error(
          `Duplicate slash command name "/${name}" defined in both the "${map.get(name)!.module}" and "${mod.name}" modules. Command names must be unique across all modules — rename one of them.`
        );
      }
      map.set(name, { command, module: mod.name });
    }
  }
  return map;
}

function allComponentHandlers(): ComponentHandler[] {
  return modules.flatMap((mod) => mod.components ?? []);
}

function findHandler(customId: string): ComponentHandler | undefined {
  return allComponentHandlers().find((h) => customId.startsWith(h.prefix));
}

export async function startBot(): Promise<void> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User]
  });

  client.lavalink = createLavalinkManager(client);
  client.on('raw', (d) => client.lavalink.sendRawData(d));

  const commandMap = buildCommandMap();

  client.once(Events.ClientReady, async (readyClient) => {
    log.info(`Logged in as ${readyClient.user.tag}`);
    setBotClient(readyClient);

    await client.lavalink.init({ id: readyClient.user.id, username: readyClient.user.username }).catch((err) => {
      log.error('Failed to initialize Lavalink — is the "lavalink" PM2 process running? See scripts/setup-lavalink.sh', err);
    });

    for (const guild of readyClient.guilds.cache.values()) {
      await prisma.guild.upsert({
        where: { id: guild.id },
        update: { name: guild.name, icon: guild.icon, ownerId: guild.ownerId },
        create: { id: guild.id, name: guild.name, icon: guild.icon, ownerId: guild.ownerId }
      });
      await prisma.guildSettings.upsert({ where: { guildId: guild.id }, update: {}, create: { guildId: guild.id } });
    }

    await registerCommandsForGuilds(readyClient.guilds.cache.keys());

    for (const mod of modules) {
      try {
        await mod.onReady?.(readyClient);
      } catch (err) {
        log.error(`onReady failed for module "${mod.name}"`, err);
      }
    }
  });

  client.on(Events.GuildCreate, async (guild) => {
    await prisma.guild.upsert({
      where: { id: guild.id },
      update: { name: guild.name, icon: guild.icon, ownerId: guild.ownerId },
      create: { id: guild.id, name: guild.name, icon: guild.icon, ownerId: guild.ownerId }
    });
    await prisma.guildSettings.upsert({ where: { guildId: guild.id }, update: {}, create: { guildId: guild.id } });
    await registerCommandsForGuild(guild.id);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const entry = commandMap.get(interaction.commandName);
        if (!entry) return;
        if (interaction.inGuild()) {
          const config = await prisma.commandConfig.findUnique({ where: { guildId_name: { guildId: interaction.guildId, name: interaction.commandName } } });
          if (config && !config.enabled) {
            await interaction.reply({ content: 'This command is disabled on this server.', ephemeral: true });
            return;
          }
        }
        await entry.command.execute(interaction as ChatInputCommandInteraction);
        return;
      }
      if (interaction.isButton()) {
        const handler = findHandler(interaction.customId);
        await handler?.handleButton?.(interaction as ButtonInteraction);
        return;
      }
      if (interaction.isStringSelectMenu()) {
        const handler = findHandler(interaction.customId);
        await handler?.handleSelect?.(interaction as StringSelectMenuInteraction);
        return;
      }
      if (interaction.isModalSubmit()) {
        const handler = findHandler(interaction.customId);
        await handler?.handleModal?.(interaction as ModalSubmitInteraction);
        return;
      }
    } catch (err) {
      log.error('Interaction handling failed', err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Something went wrong handling that.', ephemeral: true }).catch(() => undefined);
      }
    }
  });

  // Generic per-module event dispatch (messageCreate, voiceStateUpdate, guildMemberAdd, etc).
  const eventNames = new Set(modules.flatMap((mod) => Object.keys(mod.events ?? {})));
  for (const eventName of eventNames) {
    client.on(eventName, async (...args: unknown[]) => {
      for (const mod of modules) {
        const handler = mod.events?.[eventName as keyof typeof mod.events];
        if (!handler) continue;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (handler as any)(...args);
        } catch (err) {
          log.error(`Event "${eventName}" handler failed in module "${mod.name}"`, err);
        }
      }
    });
  }

  await client.login(process.env.DISCORD_TOKEN);
}
