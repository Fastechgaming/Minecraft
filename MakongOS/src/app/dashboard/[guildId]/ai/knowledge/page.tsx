import { prisma } from '../../../../../database/prisma';
import { KnowledgeManager } from '../../../../../components/dashboard/forms/KnowledgeManager';

export default async function KnowledgePage({ params }: { params: { guildId: string } }) {
  const entries = await prisma.knowledgeBase.findMany({ where: { guildId: params.guildId }, orderBy: { category: 'asc' } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="text-discord-muted">The AI grounds its answers in these entries — rules, FAQs, server info, and more.</p>
      </div>
      <KnowledgeManager
        guildId={params.guildId}
        initial={entries.map((e) => ({ id: e.id, category: e.category, title: e.title, content: e.content, keywords: e.keywords }))}
      />
    </div>
  );
}
