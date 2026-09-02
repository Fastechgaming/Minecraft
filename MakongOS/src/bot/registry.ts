import type { FeatureModule } from '../types/command';
import { coreModule } from './modules/core';
import { moderationModule } from './modules/moderation';
import { levelingModule } from './modules/leveling';
import { economyModule } from './modules/economy';
import { ticketsModule } from './modules/tickets';
import { voiceHubModule } from './modules/voicehub';
import { giveawaysModule } from './modules/giveaways';
import { reactionRolesModule } from './modules/reactionroles';
import { musicModule } from './modules/music';
import { aiModule } from './modules/ai';
import { utilityModule } from './modules/utility';

// Modules are appended here as they're built. Each module is self-contained:
// its own commands, component handlers, and event listeners.
export const modules: FeatureModule[] = [
  coreModule,
  moderationModule,
  levelingModule,
  economyModule,
  ticketsModule,
  voiceHubModule,
  giveawaysModule,
  reactionRolesModule,
  musicModule,
  aiModule,
  utilityModule
];
