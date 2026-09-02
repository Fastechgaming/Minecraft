import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  Client,
  Message,
  VoiceState,
  GuildMember,
  ClientEvents
} from 'discord.js';

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder;

export interface SlashCommand {
  data: SlashCommandData;
  /** Also usable as a Discord User App command outside of any guild. */
  userInstallable?: boolean;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface ComponentHandler {
  /** Matches a customId by string prefix. */
  prefix: string;
  handleButton?: (interaction: ButtonInteraction) => Promise<void>;
  handleSelect?: (interaction: StringSelectMenuInteraction) => Promise<void>;
  handleModal?: (interaction: ModalSubmitInteraction) => Promise<void>;
}

export interface FeatureModule {
  name: string;
  description: string;
  commands?: SlashCommand[];
  components?: ComponentHandler[];
  events?: {
    [K in keyof ClientEvents]?: (...args: ClientEvents[K]) => Promise<void> | void;
  };
  onReady?: (client: Client) => Promise<void> | void;
}

export type { Message, VoiceState, GuildMember };
