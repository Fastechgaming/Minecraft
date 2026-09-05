-- DropForeignKey
ALTER TABLE "ticket_panels" DROP CONSTRAINT "ticket_panels_guildId_fkey";

-- DropForeignKey
ALTER TABLE "ticket_categories" DROP CONSTRAINT "ticket_categories_guildId_fkey";

-- DropForeignKey
ALTER TABLE "ticket_categories" DROP CONSTRAINT "ticket_categories_panelId_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_guildId_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "modmail_threads" DROP CONSTRAINT "modmail_threads_guildId_fkey";

-- AlterTable
ALTER TABLE "guild_settings" DROP COLUMN "modmailCategoryId",
DROP COLUMN "modmailEnabled",
DROP COLUMN "modmailLogChannelId",
DROP COLUMN "ticketBlockedRoleIds",
DROP COLUMN "ticketLogChannelId",
DROP COLUMN "ticketMaxOpenPerUser",
DROP COLUMN "ticketOverflowCategoryIds",
DROP COLUMN "ticketReminderHours",
DROP COLUMN "ticketsEnabled";

-- DropTable
DROP TABLE "ticket_panels";

-- DropTable
DROP TABLE "ticket_categories";

-- DropTable
DROP TABLE "tickets";

-- DropTable
DROP TABLE "modmail_threads";

