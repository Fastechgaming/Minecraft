-- AlterTable
ALTER TABLE "guild_settings" ADD COLUMN     "ticketBlockedRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ticketOverflowCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: add the new panel columns first (title/description/style kept for now)
ALTER TABLE "ticket_panels" ADD COLUMN     "components" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "content" TEXT,
ADD COLUMN     "embeds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "openerPermissionOverrides" JSONB NOT NULL DEFAULT '{}';

-- Carry each existing panel's title/description into the new embeds column before dropping them
UPDATE "ticket_panels"
SET "embeds" = jsonb_build_array(jsonb_build_object('title', "title", 'description', "description", 'color', 5793266))
WHERE "embeds" = '[]'::jsonb;

-- Now the old columns can go
ALTER TABLE "ticket_panels" DROP COLUMN "description",
DROP COLUMN "style",
DROP COLUMN "title";

-- AlterTable
ALTER TABLE "ticket_categories" ADD COLUMN     "blockedRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "customEmbedContent" TEXT,
ADD COLUMN     "customPingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "customTicketMessage" TEXT,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "nameFormat" TEXT,
ADD COLUMN     "openerPermissionMode" TEXT NOT NULL DEFAULT 'panelDefault',
ADD COLUMN     "openerPermissionOverrides" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "overflowCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requiredRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "useTicketRolesAsPing" BOOLEAN NOT NULL DEFAULT true;
