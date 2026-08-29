-- CreateTable
CREATE TABLE "ai_escalations" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "answeredById" TEXT,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ai_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_escalations_guildId_status_idx" ON "ai_escalations"("guildId", "status");

-- AddForeignKey
ALTER TABLE "ai_escalations" ADD CONSTRAINT "ai_escalations_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
