export type Cell = null | 'X' | 'O';

export function checkWinner(board: Cell[]): 'X' | 'O' | 'draw' | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every((cell) => cell !== null)) return 'draw';
  return null;
}

export const TRIVIA_QUESTIONS: { question: string; options: string[]; correctIndex: number }[] = [
  { question: 'What block do you need to craft a Nether Portal?', options: ['Obsidian', 'Cobblestone', 'Netherrack', 'Bedrock'], correctIndex: 0 },
  { question: 'How much health does a fully-healed player have (in hearts)?', options: ['5', '10', '20', '15'], correctIndex: 1 },
  { question: 'Which mob explodes when it gets close to a player?', options: ['Zombie', 'Skeleton', 'Creeper', 'Enderman'], correctIndex: 2 },
  { question: 'What is the rarest ore in vanilla Minecraft?', options: ['Diamond', 'Emerald', 'Netherite Scrap', 'Ancient Debris'], correctIndex: 3 },
  { question: 'What do you need to tame a wolf?', options: ['Fish', 'Bones', 'Meat', 'Apples'], correctIndex: 1 },
  { question: 'Which dimension is the End in relative to the Overworld?', options: ['A layer below', 'A separate dimension', 'Above the clouds', 'Inside caves'], correctIndex: 1 }
];
