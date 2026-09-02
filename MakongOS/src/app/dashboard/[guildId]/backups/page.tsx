import { prisma } from '../../../../database/prisma';
import { BackupManager } from '../../../../components/dashboard/forms/BackupManager';

export default async function BackupsPage({ params }: { params: { guildId: string } }) {
  const backups = await prisma.serverBackup.findMany({ where: { guildId: params.guildId }, orderBy: { createdAt: 'desc' } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Server Backups</h1>
        <p className="text-discord-muted">Snapshot roles and channels, then recreate anything missing later. Restore is additive — it never deletes or renames existing structure.</p>
      </div>
      <BackupManager guildId={params.guildId} initialBackups={backups} />
    </div>
  );
}
