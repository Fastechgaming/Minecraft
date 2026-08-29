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
CREATE TABLE "welcome_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "embedTitle" TEXT NOT NULL DEFAULT '👋 Welcome {user}!',
    "embedDescription" TEXT NOT NULL DEFAULT 'Welcome to {server}! You are member #{member_count}.',
    "embedImage" TEXT,
    "embedColor" TEXT NOT NULL DEFAULT '#23A559',
    "dmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dmMessage" TEXT,
    "buttons" JSONB,
    "leaveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "leaveMessage" TEXT NOT NULL DEFAULT '{username} has left the server. We now have {member_count} members.',

    CONSTRAINT "welcome_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '!',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "embedColor" TEXT NOT NULL DEFAULT '#5865F2',
    "logChannelId" TEXT,
    "modLogChannelId" TEXT,
    "aiEscalationChannel" TEXT,
    "welcomeChannelId" TEXT,
    "leaveChannelId" TEXT,
    "aiChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "musicChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moderatorRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "djRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ticketCategoryId" TEXT,
    "moderationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "antiSpamEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "musicEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "levelingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gamesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "welcomeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "automationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiMode" TEXT NOT NULL DEFAULT 'staff',
    "aiResponseFrequency" TEXT NOT NULL DEFAULT 'normal',
    "aiMentionRequired" BOOLEAN NOT NULL DEFAULT true,
    "aiHelpDetection" BOOLEAN NOT NULL DEFAULT true,
    "aiCasualConversation" BOOLEAN NOT NULL DEFAULT false,
    "aiStaffEscalation" BOOLEAN NOT NULL DEFAULT true,
    "aiMemoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiMemoryDurationHours" INTEGER NOT NULL DEFAULT 720,
    "aiMaxHistoryMessages" INTEGER NOT NULL DEFAULT 12,
    "aiImageUnderstanding" BOOLEAN NOT NULL DEFAULT true,
    "aiImageGeneration" BOOLEAN NOT NULL DEFAULT false,
    "aiDailyLimit" INTEGER NOT NULL DEFAULT 500,
    "aiMonthlyLimit" INTEGER NOT NULL DEFAULT 10000,
    "aiPerUserCooldownSec" INTEGER NOT NULL DEFAULT 8,
    "aiPerChannelCooldownSec" INTEGER NOT NULL DEFAULT 2,
    "aiAutoModEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiAutoModHighConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "aiAutoModMedConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "aiAutoModAction" TEXT NOT NULL DEFAULT 'timeout',
    "spamWarnThreshold" INTEGER NOT NULL DEFAULT 31,
    "spamActionThreshold" INTEGER NOT NULL DEFAULT 61,
    "spamBanThreshold" INTEGER NOT NULL DEFAULT 81,
    "spamWhitelistUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spamWhitelistRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spamWhitelistChanIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "xpPerMessage" INTEGER NOT NULL DEFAULT 5,
    "xpCooldownSec" INTEGER NOT NULL DEFAULT 60,
    "xpPerVoiceMin" INTEGER NOT NULL DEFAULT 2,
    "xpLevelUpBase" INTEGER NOT NULL DEFAULT 100,
    "musicMaxQueue" INTEGER NOT NULL DEFAULT 200,
    "musicDefaultVol" INTEGER NOT NULL DEFAULT 80,
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
    "username" TEXT,
    "discriminator" TEXT,
    "avatar" TEXT,
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
    "leftAt" TIMESTAMP(3),
    "minecraftUsername" TEXT,
    "notes" TEXT,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "durationSec" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anti_spam_hits" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anti_spam_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_panels" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "title" TEXT NOT NULL DEFAULT '🎫 Support Center',
    "description" TEXT NOT NULL DEFAULT 'What do you need help with?',
    "color" TEXT NOT NULL DEFAULT '#5865F2',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT,
    "description" TEXT,
    "discordCategoryId" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "formFields" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,

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
    "claimedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "formAnswers" JSONB,
    "aiSummary" TEXT,
    "rating" INTEGER,
    "transcript" TEXT,
    "closedById" TEXT,
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorTag" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mode" TEXT NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messagesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "responses" INTEGER NOT NULL DEFAULT 0,
    "imageAnalyses" INTEGER NOT NULL DEFAULT 0,
    "imagesGenerated" INTEGER NOT NULL DEFAULT 0,
    "moderationAlerts" INTEGER NOT NULL DEFAULT 0,
    "escalations" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disabledChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cooldownSec" INTEGER NOT NULL DEFAULT 0,
    "customResponse" JSONB,

    CONSTRAINT "command_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "moderatorId" TEXT,
    "channelId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "lastVoiceAt" TIMESTAMP(3),
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastDailyAt" TIMESTAMP(3),
    "lastWeeklyAt" TIMESTAMP(3),

    CONSTRAINT "xp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_stats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "game_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_sessions" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "tracksPlayed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "music_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embed" JSONB,
    "channelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentionRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "channelId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "rsvpUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reaction_role_panels" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Choose your roles',
    "style" TEXT NOT NULL DEFAULT 'button',
    "options" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reaction_role_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minecraft_servers" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "edition" TEXT NOT NULL DEFAULT 'java',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 25565,
    "rconHost" TEXT,
    "rconPort" INTEGER,
    "rconPassword" TEXT,
    "statusChannelId" TEXT,
    "statusMessageId" TEXT,
    "chatBridgeChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "minecraft_servers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "welcome_configs_guildId_key" ON "welcome_configs"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_settings_guildId_key" ON "guild_settings"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_access_guildId_userId_key" ON "dashboard_access"("guildId", "userId");

-- CreateIndex
CREATE INDEX "members_guildId_idx" ON "members"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "members_guildId_userId_key" ON "members"("guildId", "userId");

-- CreateIndex
CREATE INDEX "moderation_cases_guildId_targetId_idx" ON "moderation_cases"("guildId", "targetId");

-- CreateIndex
CREATE INDEX "moderation_cases_guildId_createdAt_idx" ON "moderation_cases"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "warnings_guildId_userId_idx" ON "warnings"("guildId", "userId");

-- CreateIndex
CREATE INDEX "anti_spam_hits_guildId_userId_idx" ON "anti_spam_hits"("guildId", "userId");

-- CreateIndex
CREATE INDEX "ticket_panels_guildId_idx" ON "ticket_panels"("guildId");

-- CreateIndex
CREATE INDEX "ticket_categories_panelId_idx" ON "ticket_categories"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_channelId_key" ON "tickets"("channelId");

-- CreateIndex
CREATE INDEX "tickets_guildId_status_idx" ON "tickets"("guildId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_guildId_number_key" ON "tickets"("guildId", "number");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- CreateIndex
CREATE INDEX "ai_conversations_guildId_channelId_userId_createdAt_idx" ON "ai_conversations"("guildId", "channelId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_memories_guildId_userId_idx" ON "ai_memories"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_memories_guildId_userId_key_key" ON "ai_memories"("guildId", "userId", "key");

-- CreateIndex
CREATE INDEX "knowledge_base_guildId_category_idx" ON "knowledge_base"("guildId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_guildId_date_key" ON "ai_usage"("guildId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "command_configs_guildId_commandName_key" ON "command_configs"("guildId", "commandName");

-- CreateIndex
CREATE INDEX "automation_rules_guildId_trigger_idx" ON "automation_rules"("guildId", "trigger");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_type_createdAt_idx" ON "audit_logs"("guildId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_userId_idx" ON "audit_logs"("guildId", "userId");

-- CreateIndex
CREATE INDEX "xp_guildId_xp_idx" ON "xp"("guildId", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "xp_guildId_userId_key" ON "xp"("guildId", "userId");

-- CreateIndex
CREATE INDEX "game_stats_guildId_game_wins_idx" ON "game_stats"("guildId", "game", "wins");

-- CreateIndex
CREATE UNIQUE INDEX "game_stats_guildId_userId_game_key" ON "game_stats"("guildId", "userId", "game");

-- CreateIndex
CREATE INDEX "music_sessions_guildId_idx" ON "music_sessions"("guildId");

-- CreateIndex
CREATE INDEX "announcements_guildId_idx" ON "announcements"("guildId");

-- CreateIndex
CREATE INDEX "events_guildId_startsAt_idx" ON "events"("guildId", "startsAt");

-- CreateIndex
CREATE INDEX "reaction_role_panels_guildId_idx" ON "reaction_role_panels"("guildId");

-- CreateIndex
CREATE INDEX "minecraft_servers_guildId_idx" ON "minecraft_servers"("guildId");

-- AddForeignKey
ALTER TABLE "welcome_configs" ADD CONSTRAINT "welcome_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anti_spam_hits" ADD CONSTRAINT "anti_spam_hits_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_panels" ADD CONSTRAINT "ticket_panels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "ticket_panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_configs" ADD CONSTRAINT "command_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp" ADD CONSTRAINT "xp_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "music_sessions" ADD CONSTRAINT "music_sessions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaction_role_panels" ADD CONSTRAINT "reaction_role_panels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minecraft_servers" ADD CONSTRAINT "minecraft_servers_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
