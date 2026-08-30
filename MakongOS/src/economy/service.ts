import { prisma } from '../database/prisma';

export async function getProfile(guildId: string, userId: string) {
  return prisma.economyProfile.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId },
    update: {}
  });
}

const HOUR_MS = 60 * 60 * 1000;

export interface DailyResult {
  success: boolean;
  message: string;
  amount?: number;
  streak?: number;
}

export async function claimDaily(guildId: string, userId: string, amount: number): Promise<DailyResult> {
  const profile = await getProfile(guildId, userId);
  const now = new Date();

  if (profile.lastDailyAt) {
    const hoursSince = (now.getTime() - profile.lastDailyAt.getTime()) / HOUR_MS;
    if (hoursSince < 24) {
      const remaining = Math.ceil(24 - hoursSince);
      return { success: false, message: `⏳ You can claim your daily reward again in about ${remaining}h.` };
    }
  }

  const hoursSince = profile.lastDailyAt ? (now.getTime() - profile.lastDailyAt.getTime()) / HOUR_MS : Infinity;
  const streak = hoursSince < 48 ? profile.dailyStreak + 1 : 1;

  await prisma.economyProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: { coins: { increment: amount }, dailyStreak: streak, lastDailyAt: now }
  });

  return { success: true, message: `You got **${amount}** coins as your daily reward!`, amount, streak };
}

const BEG_DONORS = [
  'PewDiePie', 'T-Series', 'Sans', 'A Random Villager', 'A Pro Gamer', 'Zenitsu', 'Mr. Beast', 'Ur Mom',
  'A Broke Person', 'The Ender Dragon', 'A Random Chicken', 'Steve', 'Alex', 'A Creeper (surprisingly generous)',
  'Notch', 'The IRS', 'Joe Mama', 'A Villager With No Trades'
];

export interface BegResult {
  success: boolean;
  message: string;
  amount?: number;
  donor?: string;
}

export async function beg(guildId: string, userId: string, min: number, max: number, cooldownSec: number): Promise<BegResult> {
  const profile = await getProfile(guildId, userId);
  const now = new Date();

  if (profile.lastBegAt) {
    const secondsSince = (now.getTime() - profile.lastBegAt.getTime()) / 1000;
    if (secondsSince < cooldownSec) {
      const remaining = Math.ceil((cooldownSec - secondsSince) / 60);
      return { success: false, message: `⏳ You can beg again in about ${remaining}m.` };
    }
  }

  const amount = Math.floor(Math.random() * (max - min + 1)) + min;
  const donor = BEG_DONORS[Math.floor(Math.random() * BEG_DONORS.length)]!;

  await prisma.economyProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: { coins: { increment: amount }, lastBegAt: now }
  });

  return { success: true, message: `**${donor}** donated you **${amount}** coins!`, amount, donor };
}

const SLOT_EMOJIS = ['🍒', '🍋', '🍉', '🍇', '🍓', '🍑', '🍍', '🥝', '🍌'];

export interface GambleResult {
  success: boolean;
  message: string;
  slots?: string[];
  reward?: number;
  balance?: number;
}

export async function gamble(guildId: string, userId: string, betAmount: number): Promise<GambleResult> {
  if (betAmount < 10) return { success: false, message: 'Bet amount cannot be less than 10 coins.' };

  const profile = await getProfile(guildId, userId);
  if (profile.coins < betAmount) return { success: false, message: `You do not have enough coins! Balance: **${profile.coins}**` };

  const roll = () => SLOT_EMOJIS[Math.floor(Math.random() * SLOT_EMOJIS.length)]!;
  const slots = [roll(), roll(), roll()];

  let multiplier = 0;
  if (slots[0] === slots[1] && slots[1] === slots[2]) multiplier = 3;
  else if (slots[0] === slots[1] || slots[1] === slots[2] || slots[0] === slots[2]) multiplier = 2;

  const reward = multiplier * betAmount;
  const delta = reward - betAmount;

  const updated = await prisma.economyProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: { coins: { increment: delta } }
  });

  return {
    success: true,
    message: reward > 0 ? `You won **${reward}** coins!` : `You lost **${betAmount}** coins.`,
    slots,
    reward,
    balance: updated.coins
  };
}

export interface BankResult {
  success: boolean;
  message: string;
}

export async function deposit(guildId: string, userId: string, amount: number): Promise<BankResult> {
  if (amount <= 0) return { success: false, message: 'Amount must be positive.' };
  const profile = await getProfile(guildId, userId);
  if (profile.coins < amount) return { success: false, message: `You only have **${profile.coins}** coins in your wallet.` };

  await prisma.economyProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: { coins: { decrement: amount }, bank: { increment: amount } }
  });
  return { success: true, message: `✅ Deposited **${amount}** coins into your bank.` };
}

export async function withdraw(guildId: string, userId: string, amount: number): Promise<BankResult> {
  if (amount <= 0) return { success: false, message: 'Amount must be positive.' };
  const profile = await getProfile(guildId, userId);
  if (profile.bank < amount) return { success: false, message: `You only have **${profile.bank}** coins in your bank.` };

  await prisma.economyProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: { coins: { increment: amount }, bank: { decrement: amount } }
  });
  return { success: true, message: `✅ Withdrew **${amount}** coins from your bank.` };
}

export async function transfer(guildId: string, fromUserId: string, toUserId: string, amount: number): Promise<BankResult> {
  if (amount <= 0) return { success: false, message: 'Amount must be positive.' };
  if (fromUserId === toUserId) return { success: false, message: 'You cannot transfer coins to yourself.' };

  const from = await getProfile(guildId, fromUserId);
  if (from.coins < amount) return { success: false, message: `You only have **${from.coins}** coins.` };
  await getProfile(guildId, toUserId);

  await prisma.$transaction([
    prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId: fromUserId } }, data: { coins: { decrement: amount } } }),
    prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId: toUserId } }, data: { coins: { increment: amount } } })
  ]);

  return { success: true, message: `✅ Transferred **${amount}** coins to <@${toUserId}>.` };
}

export interface RepResult {
  success: boolean;
  message: string;
}

export async function giveReputation(guildId: string, fromUserId: string, toUserId: string): Promise<RepResult> {
  if (fromUserId === toUserId) return { success: false, message: 'You cannot give reputation to yourself.' };

  const from = await getProfile(guildId, fromUserId);
  const now = new Date();
  if (from.lastRepAt) {
    const hoursSince = (now.getTime() - from.lastRepAt.getTime()) / HOUR_MS;
    if (hoursSince < 24) {
      const remaining = Math.ceil(24 - hoursSince);
      return { success: false, message: `⏳ You can give reputation again in about ${remaining}h.` };
    }
  }

  await getProfile(guildId, toUserId);
  await prisma.$transaction([
    prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId: fromUserId } }, data: { repGiven: { increment: 1 }, lastRepAt: now } }),
    prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId: toUserId } }, data: { repReceived: { increment: 1 } } })
  ]);

  return { success: true, message: `+1 Rep given!` };
}

export async function getEconomyLeaderboard(guildId: string, limit = 10) {
  return prisma.economyProfile.findMany({
    where: { guildId },
    orderBy: [{ coins: 'desc' }],
    take: limit
  });
}
