/*
  Warnings:

  - You are about to drop the column `moderationAlerts` on the `ai_usage` table. All the data in the column will be lost.
  - You are about to drop the column `customResponse` on the `command_configs` table. All the data in the column will be lost.
  - You are about to drop the column `aiAutoModAction` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `aiAutoModEnabled` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `aiAutoModHighConfidence` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `aiAutoModMedConfidence` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `antiSpamEnabled` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `automationEnabled` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `defaultRoleIds` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `gamesEnabled` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `leaveChannelId` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `modLogChannelId` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `moderationEnabled` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `moderatorRoleIds` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `spamActionThreshold` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `spamBanThreshold` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `spamWarnThreshold` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `spamWhitelistChanIds` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `spamWhitelistRoleIds` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `spamWhitelistUserIds` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `ticketCategoryId` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `welcomeChannelId` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `welcomeEnabled` on the `guild_settings` table. All the data in the column will be lost.
  - You are about to drop the column `minecraftUsername` on the `members` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `members` table. All the data in the column will be lost.
  - You are about to drop the column `formFields` on the `ticket_categories` table. All the data in the column will be lost.
  - You are about to drop the column `aiSummary` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the column `formAnswers` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the column `lastDailyAt` on the `xp` table. All the data in the column will be lost.
  - You are about to drop the column `lastWeeklyAt` on the `xp` table. All the data in the column will be lost.
  - You are about to drop the column `streakDays` on the `xp` table. All the data in the column will be lost.
  - You are about to drop the `announcements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `anti_spam_hits` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `automation_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `game_stats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `minecraft_servers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `moderation_cases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reaction_role_panels` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ticket_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `warnings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `welcome_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "announcements" DROP CONSTRAINT "announcements_guildId_fkey";

-- DropForeignKey
ALTER TABLE "anti_spam_hits" DROP CONSTRAINT "anti_spam_hits_guildId_fkey";

-- DropForeignKey
ALTER TABLE "automation_rules" DROP CONSTRAINT "automation_rules_guildId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_guildId_fkey";

-- DropForeignKey
ALTER TABLE "game_stats" DROP CONSTRAINT "game_stats_guildId_fkey";

-- DropForeignKey
ALTER TABLE "game_stats" DROP CONSTRAINT "game_stats_userId_fkey";

-- DropForeignKey
ALTER TABLE "minecraft_servers" DROP CONSTRAINT "minecraft_servers_guildId_fkey";

-- DropForeignKey
ALTER TABLE "moderation_cases" DROP CONSTRAINT "moderation_cases_guildId_fkey";

-- DropForeignKey
ALTER TABLE "moderation_cases" DROP CONSTRAINT "moderation_cases_moderatorId_fkey";

-- DropForeignKey
ALTER TABLE "moderation_cases" DROP CONSTRAINT "moderation_cases_targetId_fkey";

-- DropForeignKey
ALTER TABLE "reaction_role_panels" DROP CONSTRAINT "reaction_role_panels_guildId_fkey";

-- DropForeignKey
ALTER TABLE "ticket_messages" DROP CONSTRAINT "ticket_messages_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "warnings" DROP CONSTRAINT "warnings_guildId_fkey";

-- DropForeignKey
ALTER TABLE "warnings" DROP CONSTRAINT "warnings_userId_fkey";

-- DropForeignKey
ALTER TABLE "welcome_configs" DROP CONSTRAINT "welcome_configs_guildId_fkey";

-- AlterTable
ALTER TABLE "ai_usage" DROP COLUMN "moderationAlerts";

-- AlterTable
ALTER TABLE "command_configs" DROP COLUMN "customResponse";

-- AlterTable
ALTER TABLE "guild_settings" DROP COLUMN "aiAutoModAction",
DROP COLUMN "aiAutoModEnabled",
DROP COLUMN "aiAutoModHighConfidence",
DROP COLUMN "aiAutoModMedConfidence",
DROP COLUMN "antiSpamEnabled",
DROP COLUMN "automationEnabled",
DROP COLUMN "defaultRoleIds",
DROP COLUMN "gamesEnabled",
DROP COLUMN "leaveChannelId",
DROP COLUMN "modLogChannelId",
DROP COLUMN "moderationEnabled",
DROP COLUMN "moderatorRoleIds",
DROP COLUMN "spamActionThreshold",
DROP COLUMN "spamBanThreshold",
DROP COLUMN "spamWarnThreshold",
DROP COLUMN "spamWhitelistChanIds",
DROP COLUMN "spamWhitelistRoleIds",
DROP COLUMN "spamWhitelistUserIds",
DROP COLUMN "ticketCategoryId",
DROP COLUMN "welcomeChannelId",
DROP COLUMN "welcomeEnabled",
ADD COLUMN     "economyBegCooldownSec" INTEGER NOT NULL DEFAULT 21600,
ADD COLUMN     "economyBegMax" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "economyBegMin" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "economyCurrencySymbol" TEXT NOT NULL DEFAULT '🪙',
ADD COLUMN     "economyDailyAmount" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "economyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "funEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "giveawaysEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "suggestionsChannelId" TEXT,
ADD COLUMN     "suggestionsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ticketLogChannelId" TEXT,
ADD COLUMN     "ticketMaxOpenPerUser" INTEGER NOT NULL DEFAULT 2,
ALTER COLUMN "aiEnabled" SET DEFAULT true;

-- AlterTable
ALTER TABLE "members" DROP COLUMN "minecraftUsername",
DROP COLUMN "notes";

-- AlterTable
ALTER TABLE "ticket_categories" DROP COLUMN "formFields";

-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "aiSummary",
DROP COLUMN "formAnswers",
DROP COLUMN "rating";

-- AlterTable
ALTER TABLE "xp" DROP COLUMN "lastDailyAt",
DROP COLUMN "lastWeeklyAt",
DROP COLUMN "streakDays";

-- DropTable
DROP TABLE "announcements";

-- DropTable
DROP TABLE "anti_spam_hits";

-- DropTable
DROP TABLE "automation_rules";

-- DropTable
DROP TABLE "events";

-- DropTable
DROP TABLE "game_stats";

-- DropTable
DROP TABLE "minecraft_servers";

-- DropTable
DROP TABLE "moderation_cases";

-- DropTable
DROP TABLE "reaction_role_panels";

-- DropTable
DROP TABLE "ticket_messages";

-- DropTable
DROP TABLE "warnings";

-- DropTable
DROP TABLE "welcome_configs";

-- CreateTable
CREATE TABLE "economy_profiles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "bank" INTEGER NOT NULL DEFAULT 0,
    "dailyStreak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyAt" TIMESTAMP(3),
    "lastBegAt" TIMESTAMP(3),
    "repGiven" INTEGER NOT NULL DEFAULT 0,
    "repReceived" INTEGER NOT NULL DEFAULT 0,
    "lastRepAt" TIMESTAMP(3),

    CONSTRAINT "economy_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaways" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "hostedById" TEXT NOT NULL,
    "entrantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "winnerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "endsAt" TIMESTAMP(3) NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "economy_profiles_guildId_coins_idx" ON "economy_profiles"("guildId", "coins");

-- CreateIndex
CREATE INDEX "economy_profiles_guildId_repReceived_idx" ON "economy_profiles"("guildId", "repReceived");

-- CreateIndex
CREATE UNIQUE INDEX "economy_profiles_guildId_userId_key" ON "economy_profiles"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "suggestions_messageId_key" ON "suggestions"("messageId");

-- CreateIndex
CREATE INDEX "suggestions_guildId_status_idx" ON "suggestions"("guildId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "giveaways_messageId_key" ON "giveaways"("messageId");

-- CreateIndex
CREATE INDEX "giveaways_guildId_ended_endsAt_idx" ON "giveaways"("guildId", "ended", "endsAt");

-- AddForeignKey
ALTER TABLE "economy_profiles" ADD CONSTRAINT "economy_profiles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
