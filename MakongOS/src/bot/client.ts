import { Client, GatewayIntentBits, Partials, Collection, Events, MessageFlags } from 'discord.js';
import type { Command, ComponentRoute, CommandContext } from '../types/command';
import { modules } from './registry';
import { prisma } from '../database/prisma';
import { ensureGuild } from '../database/settingsCache';
import { consumeCooldown, remainingCooldownMs } from '../services/cooldowns';
import { recordAuditLog } from '../services/auditLog';
import { createLogger } from '../services/logger';
import { automationEngine } from '../automation/engine';
import { publishBotClient, publishCommandRegistry } from './globalClient';
import { registerCommandsForGuild, registerCommandsForGuilds } from './registerCommands';

const log = createLogger('bot');

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember]
});

export const commands = new Collection<string, Command>();
export const componentRoutes: ComponentRoute[] = [];

const ctx: CommandContext = { client };

function registerModules() {
  for (const mod of modules) {
    for (const command of mod.commands ?? []) {
      commands.set(command.data.name, command);
    }
    for (const route of mod.components ?? []) {
      componentRoutes.push(route);
    }
    for (const evt of mod.events ?? []) {
      const listener = (...args: unknown[]) => evt.handler(...args, ctx);
      if (evt.once) client.once(evt.event, listener as never);
      else client.on(evt.event, listener as never);
    }
  }
  publishCommandRegistry(
    [...commands.values()].map((c) => ({
      name: c.data.name,
      description: c.data.description,
      module: c.module,
      defaultCooldownSec: c.defaultCooldownSec ?? 0
    }))
  );
  log.info(`Registered ${commands.size} commands, ${componentRoutes.length} component routes across ${modules.length} modules`);
}

client.once(Events.ClientReady, async (readyClient) => {
  log.info(`Logged in as ${readyClient.user.tag}`);

  for (const guild of readyClient.guilds.cache.values()) {
    await ensureGuild({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      ownerId: guild.ownerId
    }).catch((err) => log.error('ensureGuild failed', err));
  }

  // Guild-scoped registration propagates near-instantly (global commands can
  // take up to an hour), so slash commands stay in sync on every startup
  // with no manual `npm run deploy:commands` step required.
  await registerCommandsForGuilds(readyClient.guilds.cache.keys()).catch((err) =>
    log.error('Failed to sync slash commands on ready', err)
  );

  for (const mod of modules) {
    if (mod.onReady) {
      await Promise.resolve(mod.onReady(ctx)).catch((err) => log.error(`onReady failed for ${mod.name}`, err));
    }
  }
});

client.on(Events.GuildCreate, async (guild) => {
  await ensureGuild({ id: guild.id, name: guild.name, icon: guild.iconURL(), ownerId: guild.ownerId });
  await registerCommandsForGuild(guild.id).catch((err) => log.error(`Failed to sync commands to new guild ${guild.id}`, err));
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;

      if (interaction.inGuild()) {
        const allowed = await checkCommandGate(
          command,
          interaction.guildId!,
          interaction.channelId,
          interaction.user.id,
          interaction.member?.roles as never
        );
        if (!allowed.ok) {
          await interaction.reply({ content: allowed.reason, flags: MessageFlags.Ephemeral });
          return;
        }
      }

      await command.execute(interaction, ctx);

      if (interaction.inGuild()) {
        await recordAuditLog(client, {
          guildId: interaction.guildId!,
          type: 'command',
          action: `/${interaction.commandName}`,
          userId: interaction.user.id,
          channelId: interaction.channelId
        });
        await automationEngine.trigger(client, 'command_used', {
          guildId: interaction.guildId!,
          userId: interaction.user.id,
          channelId: interaction.channelId,
          data: { command: interaction.commandName }
        });
      }
      return;
    }

    const customId = (interaction as { customId?: string }).customId;
    if (!customId) return;
    const route = componentRoutes.find((r) => customId.startsWith(r.prefix));
    if (!route) return;

    if (interaction.isButton() && route.button) await route.button(interaction, ctx);
    else if (interaction.isStringSelectMenu() && route.select) await route.select(interaction, ctx);
    else if (interaction.isModalSubmit() && route.modal) await route.modal(interaction, ctx);
  } catch (err) {
    log.error('Interaction handling failed', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: '⚠️ Something went wrong running that. The team has been notified.', flags: MessageFlags.Ephemeral })
        .catch(() => undefined);
    }
    if (interaction.inGuild()) {
      await recordAuditLog(client, {
        guildId: interaction.guildId!,
        type: 'error',
        action: 'interaction_error',
        details: { message: (err as Error).message }
      }).catch(() => undefined);
    }
  }
});

async function checkCommandGate(
  command: Command,
  guildId: string,
  channelId: string,
  userId: string,
  roles: { cache: Map<string, unknown> } | undefined
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const config = await prisma.commandConfig.findUnique({
    where: { guildId_commandName: { guildId, commandName: command.data.name } }
  });

  if (config) {
    if (!config.enabled) return { ok: false, reason: '🚫 This command is disabled on this server.' };
    if (config.disabledChannelIds.includes(channelId)) {
      return { ok: false, reason: '🚫 This command is disabled in this channel.' };
    }
    if (config.allowedRoleIds.length > 0 && roles) {
      const hasRole = config.allowedRoleIds.some((id) => roles.cache.has(id));
      if (!hasRole) return { ok: false, reason: '🚫 You do not have permission to use this command here.' };
    }
  }

  const cooldownSec = config?.cooldownSec ?? command.defaultCooldownSec ?? 0;
  if (cooldownSec > 0) {
    const key = `cmd:${guildId}:${command.data.name}:${userId}`;
    if (!consumeCooldown(key, cooldownSec * 1000)) {
      const remaining = Math.ceil(remainingCooldownMs(key, cooldownSec * 1000) / 1000);
      return { ok: false, reason: `⏳ Slow down! Try again in ${remaining}s.` };
    }
  }

  return { ok: true };
}

export function startBot(): Promise<void> {
  registerModules();
  publishBotClient(client);
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    log.warn('DISCORD_TOKEN not set — bot will not connect to Discord. Dashboard will still run.');
    return Promise.resolve();
  }
  return client.login(token).then(() => undefined);
}
