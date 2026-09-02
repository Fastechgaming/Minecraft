import { prisma } from '../../../../../database/prisma';
import { KnowledgeManager } from '../../../../../components/dashboard/forms/KnowledgeManager';

export default async function KnowledgePage({ params }: { params: { guildId: string } }) {
  const entries = await prisma.knowledgeBase.findMany({ where: { guildId: params.guildId }, orderBy: { createdAt: 'desc' } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="text-discord-muted">Facts the AI assistant draws on to answer questions accurately.</p>
      </div>
      <KnowledgeManager guildId={params.guildId} initialEntries={entries} />
    </div>
  );
}
