import { prisma } from '../database/prisma';

export async function searchKnowledge(guildId: string, query: string, limit = 4) {
  const entries = await prisma.knowledgeBase.findMany({ where: { guildId } });
  if (entries.length === 0) return [];

  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

  const scored = entries.map((entry) => {
    const haystack = `${entry.title} ${entry.content} ${entry.keywords.join(' ')}`.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (word.length < 3) continue;
      if (haystack.includes(word)) score++;
    }
    if (entry.keywords.some((k) => query.toLowerCase().includes(k.toLowerCase()))) score += 3;
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

export function formatKnowledgeForPrompt(entries: { category: string; title: string; content: string }[]): string {
  if (entries.length === 0) return 'No relevant knowledge base entries found.';
  return entries.map((e) => `[${e.category}] ${e.title}: ${e.content}`).join('\n---\n');
}
