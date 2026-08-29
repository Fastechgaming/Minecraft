import type { FeatureModule } from '../types/command';
import { coreModule } from './modules/core';
import { moderationModule } from './modules/moderation';
import { antiSpamModule } from './modules/antispam';
import { ticketsModule } from './modules/tickets';
import { musicModule } from './modules/music';
import { gamesModule } from './modules/games';
import { funModule } from './modules/fun';
import { xpModule } from './modules/xp';
import { welcomeModule } from './modules/welcome';
import { rolesModule } from './modules/roles';
import { aiModule } from './modules/ai';
import { automationModule } from './modules/automation';
import { minecraftModule } from './modules/minecraft';

/**
 * Every feature ships as a self-contained FeatureModule (commands, events,
 * component routes). Adding a new system later — e.g. giveaways — means
 * writing one new module file and adding it to this list; nothing else in
 * the bot needs to change.
 */
export const modules: FeatureModule[] = [
  coreModule,
  moderationModule,
  antiSpamModule,
  ticketsModule,
  musicModule,
  gamesModule,
  funModule,
  xpModule,
  welcomeModule,
  rolesModule,
  aiModule,
  automationModule,
  minecraftModule
];
