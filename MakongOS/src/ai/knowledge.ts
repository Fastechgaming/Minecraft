import { prisma } from '../database/prisma';

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

export interface KnowledgeMatch {
  question: string;
  answer: string;
  category: string;
  score: number;
}

export async function findRelevantKnowledge(guildId: string, query: string, limit = 3): Promise<KnowledgeMatch[]> {
  const entries = await prisma.knowledgeBase.findMany({ where: { guildId } });
  if (entries.length === 0) return [];

  const queryTokens = tokenize(query);
  const scored = entries.map((entry) => {
    const entryTokens = tokenize(`${entry.question} ${entry.answer} ${entry.category}`);
    let overlap = 0;
    for (const token of queryTokens) if (entryTokens.has(token)) overlap++;
    return { question: entry.question, answer: entry.answer, category: entry.category, score: overlap };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
