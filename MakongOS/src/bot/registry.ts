import type { FeatureModule } from '../types/command';
import { coreModule } from './modules/core';
import { musicModule } from './modules/music';
import { aiModule } from './modules/ai';
import { economyModule } from './modules/economy';
import { funModule } from './modules/fun';
import { ticketsModule } from './modules/tickets';
import { suggestionsModule } from './modules/suggestions';
import { giveawaysModule } from './modules/giveaways';
import { utilityModule } from './modules/utility';

/**
 * Every feature ships as a self-contained FeatureModule (commands, events,
 * component routes). Adding a new system later means writing one new module
 * file and adding it to this list; nothing else in the bot needs to change.
 */
export const modules: FeatureModule[] = [
  coreModule,
  aiModule,
  musicModule,
  economyModule,
  funModule,
  ticketsModule,
  suggestionsModule,
  giveawaysModule,
  utilityModule
];
