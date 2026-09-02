-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "moderationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "antiScamEnabled" BOOLEAN NOT NULL DEFAULT true,
    "musicEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "modmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "levelingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "economyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voiceHubEnabled" BOOLEAN NOT NULL DEFAULT false,
    "giveawaysEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reactionRolesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "socialAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "prefix" TEXT NOT NULL DEFAULT '!',
    "logChannelId" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "automodBlockInvites" BOOLEAN NOT NULL DEFAULT true,
    "automodBlockBadWords" BOOLEAN NOT NULL DEFAULT true,
    "automodBadWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "automodBlockSpam" BOOLEAN NOT NULL DEFAULT true,
    "automodSpamMsgCount" INTEGER NOT NULL DEFAULT 5,
    "automodSpamWindowSec" INTEGER NOT NULL DEFAULT 6,
    "automodBlockGhostPing" BOOLEAN NOT NULL DEFAULT true,
    "automodWhitelistRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "automodWhitelistChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modLogChannelId" TEXT,
    "warningDecayDays" INTEGER NOT NULL DEFAULT 30,
    "antiScamAction" TEXT NOT NULL DEFAULT 'timeout',
    "antiScamTimeoutMin" INTEGER NOT NULL DEFAULT 60,
    "antiScamWhitelistRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "antiScamWhitelistChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiChatChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiMode" TEXT NOT NULL DEFAULT 'hybrid',
    "aiPersonality" TEXT,
    "aiEscalationChannelId" TEXT,
    "aiConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "xpPerMessage" INTEGER NOT NULL DEFAULT 15,
    "xpCooldownSec" INTEGER NOT NULL DEFAULT 60,
    "xpPerVoiceMin" INTEGER NOT NULL DEFAULT 10,
    "xpLevelUpBase" INTEGER NOT NULL DEFAULT 100,
    "levelUpChannelId" TEXT,
    "levelRoleRewards" JSONB NOT NULL DEFAULT '[]',
    "economyCurrencyName" TEXT NOT NULL DEFAULT 'Coins',
    "economyCurrencySymbol" TEXT NOT NULL DEFAULT '🪙',
    "economyDailyAmount" INTEGER NOT NULL DEFAULT 250,
    "economyWorkMin" INTEGER NOT NULL DEFAULT 50,
    "economyWorkMax" INTEGER NOT NULL DEFAULT 200,
    "economyRobEnabled" BOOLEAN NOT NULL DEFAULT true,
    "economyRobSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "ticketLogChannelId" TEXT,
    "ticketMaxOpenPerUser" INTEGER NOT NULL DEFAULT 1,
    "ticketReminderHours" INTEGER NOT NULL DEFAULT 24,
    "modmailCategoryId" TEXT,
    "modmailLogChannelId" TEXT,
    "voiceHubSetupChannelId" TEXT,
    "voiceHubCategoryId" TEXT,
    "voiceHubDefaultName" TEXT NOT NULL DEFAULT '{user}''s Channel',
    "voiceHubDefaultLimit" INTEGER NOT NULL DEFAULT 0,
    "welcomeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "welcomeChannelId" TEXT,
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Welcome {user} to {server}!',
    "leaveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "leaveChannelId" TEXT,
    "leaveMessage" TEXT NOT NULL DEFAULT '{user} has left {server}.',
    "autoRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "musicMaxQueue" INTEGER NOT NULL DEFAULT 200,
    "musicDefaultVol" INTEGER NOT NULL DEFAULT 100,
    "musicDjRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_access" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "discriminator" TEXT,
    "avatar" TEXT,
    "isBotOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetTag" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "moderatorTag" TEXT NOT NULL,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temp_roles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temp_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "textXp" INTEGER NOT NULL DEFAULT 0,
    "voiceXp" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "lastVoiceTickAt" TIMESTAMP(3),

    CONSTRAINT "xp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_profiles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wallet" INTEGER NOT NULL DEFAULT 0,
    "bank" INTEGER NOT NULL DEFAULT 0,
    "dailyStreak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyAt" TIMESTAMP(3),
    "lastWorkAt" TIMESTAMP(3),
    "lastRobAt" TIMESTAMP(3),

    CONSTRAINT "economy_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "roleId" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '📦',
    "stock" INTEGER,

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_panels" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Support',
    "description" TEXT NOT NULL DEFAULT 'Select a category below to open a ticket.',
    "style" TEXT NOT NULL DEFAULT 'select',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "panelId" TEXT,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎫',
    "categoryChannelId" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "formFields" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "categoryId" TEXT,
    "number" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "openerId" TEXT NOT NULL,
    "openerTag" TEXT NOT NULL,
    "claimedById" TEXT,
    "formResponses" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "transcriptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modmail_threads" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "modmail_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temp_voice_channels" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temp_voice_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaways" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "prize" TEXT NOT NULL,
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "hostId" TEXT NOT NULL,
    "requiredRoleId" TEXT,
    "entrantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "winnerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "endsAt" TIMESTAMP(3) NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reaction_role_panels" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Roles',
    "style" TEXT NOT NULL DEFAULT 'dropdown',
    "options" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reaction_role_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_alerts" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channelHandle" TEXT NOT NULL,
    "announceChannelId" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '{creator} is now live! {url}',
    "lastSeenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_backups" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_escalations" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "answeredById" TEXT,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatMessages" INTEGER NOT NULL DEFAULT 0,
    "imagesGenerated" INTEGER NOT NULL DEFAULT 0,
    "scansPerformed" INTEGER NOT NULL DEFAULT 0,
    "escalations" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "command_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "premium_vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'premium',
    "redeemedByGuildId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premium_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_settings_guildId_key" ON "guild_settings"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_access_guildId_userId_key" ON "dashboard_access"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "members_guildId_userId_key" ON "members"("guildId", "userId");

-- CreateIndex
CREATE INDEX "moderation_cases_guildId_targetId_idx" ON "moderation_cases"("guildId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_cases_guildId_caseNumber_key" ON "moderation_cases"("guildId", "caseNumber");

-- CreateIndex
CREATE INDEX "warnings_guildId_userId_idx" ON "warnings"("guildId", "userId");

-- CreateIndex
CREATE INDEX "temp_roles_guildId_expiresAt_idx" ON "temp_roles"("guildId", "expiresAt");

-- CreateIndex
CREATE INDEX "xp_guildId_textXp_idx" ON "xp"("guildId", "textXp");

-- CreateIndex
CREATE UNIQUE INDEX "xp_guildId_userId_key" ON "xp"("guildId", "userId");

-- CreateIndex
CREATE INDEX "economy_profiles_guildId_wallet_idx" ON "economy_profiles"("guildId", "wallet");

-- CreateIndex
CREATE UNIQUE INDEX "economy_profiles_guildId_userId_key" ON "economy_profiles"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_profileId_itemId_key" ON "inventory_items"("profileId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_guildId_number_key" ON "tickets"("guildId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "modmail_threads_guildId_userId_status_key" ON "modmail_threads"("guildId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "temp_voice_channels_channelId_key" ON "temp_voice_channels"("channelId");

-- CreateIndex
CREATE INDEX "giveaways_guildId_ended_endsAt_idx" ON "giveaways"("guildId", "ended", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_alerts_guildId_platform_channelHandle_key" ON "social_alerts"("guildId", "platform", "channelHandle");

-- CreateIndex
CREATE INDEX "knowledge_base_guildId_idx" ON "knowledge_base"("guildId");

-- CreateIndex
CREATE INDEX "ai_conversations_guildId_userId_createdAt_idx" ON "ai_conversations"("guildId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_memories_guildId_userId_idx" ON "ai_memories"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_guildId_date_key" ON "ai_usage"("guildId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "command_configs_guildId_name_key" ON "command_configs"("guildId", "name");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_type_createdAt_idx" ON "audit_logs"("guildId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "premium_vouchers_code_key" ON "premium_vouchers"("code");

-- AddForeignKey
ALTER TABLE "guild_settings" ADD CONSTRAINT "guild_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_access" ADD CONSTRAINT "dashboard_access_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temp_roles" ADD CONSTRAINT "temp_roles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp" ADD CONSTRAINT "xp_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_profiles" ADD CONSTRAINT "economy_profiles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_profiles" ADD CONSTRAINT "economy_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "economy_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "shop_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_panels" ADD CONSTRAINT "ticket_panels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "ticket_panels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modmail_threads" ADD CONSTRAINT "modmail_threads_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temp_voice_channels" ADD CONSTRAINT "temp_voice_channels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaction_role_panels" ADD CONSTRAINT "reaction_role_panels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_alerts" ADD CONSTRAINT "social_alerts_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_backups" ADD CONSTRAINT "server_backups_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_escalations" ADD CONSTRAINT "ai_escalations_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_configs" ADD CONSTRAINT "command_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

