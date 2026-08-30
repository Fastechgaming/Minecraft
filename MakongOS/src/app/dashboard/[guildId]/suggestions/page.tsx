import { prisma } from '../../../../database/prisma';
import { SuggestionQueue } from '../../../../components/dashboard/forms/SuggestionQueue';

export default async function SuggestionsPage({ params }: { params: { guildId: string } }) {
  const suggestions = await prisma.suggestion.findMany({
    where: { guildId: params.guildId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Suggestions</h1>
        <p className="text-discord-muted">
          {suggestions.length} pending. Configure the destination channel under <span className="text-white">Server → General</span>.
        </p>
      </div>
      <SuggestionQueue
        guildId={params.guildId}
        initial={suggestions.map((s) => ({ id: s.id, userId: s.userId, content: s.content, upvotes: s.upvotes, downvotes: s.downvotes, createdAt: s.createdAt.toISOString() }))}
      />
    </div>
  );
}
