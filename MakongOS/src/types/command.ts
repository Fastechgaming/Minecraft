import type {
  ChatInputCommandInteraction,
  ClientEvents,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  Client
} from 'discord.js';

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface CommandContext {
  client: Client;
}

export interface Command {
  data: SlashCommandData;
  /** Module this command belongs to, used for CommandConfig lookups + dashboard grouping. */
  module: string;
  /** Default cooldown in seconds, overridable per-guild from the dashboard. */
  defaultCooldownSec?: number;
  execute: (interaction: ChatInputCommandInteraction, ctx: CommandContext) => Promise<void>;
}

export type ComponentHandler<T> = (interaction: T, ctx: CommandContext) => Promise<void>;

export interface ComponentRoute {
  /** Matches customId via `startsWith`. */
  prefix: string;
  button?: ComponentHandler<ButtonInteraction>;
  select?: ComponentHandler<StringSelectMenuInteraction>;
  modal?: ComponentHandler<ModalSubmitInteraction>;
}

export interface EventHandler<K extends keyof ClientEvents = keyof ClientEvents> {
  event: K;
  once?: boolean;
  /**
   * Receives the event's own arguments followed by the shared CommandContext.
   * Typed loosely (rather than as a spread tuple) because TS's structural
   * checks reject "fewer declared params than the target" for rest-tuple
   * function types — every module writes handlers with only the params it
   * needs, same as an Array callback ignoring the index/array args.
   */
  handler: (...args: any[]) => Promise<void> | void;
}

export interface FeatureModule {
  name: string;
  description: string;
  commands?: Command[];
  components?: ComponentRoute[];
  events?: EventHandler<any>[];
  /** Called once after the client logs in. */
  onReady?: (ctx: CommandContext) => Promise<void> | void;
}
