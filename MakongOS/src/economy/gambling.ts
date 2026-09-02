export function flipCoin(): 'heads' | 'tails' {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

const SLOT_SYMBOLS = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
const SLOT_WEIGHTS = [30, 25, 20, 15, 8, 2]; // 7️⃣ is rarest

function weightedSlotSymbol(): string {
  const total = SLOT_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
    roll -= SLOT_WEIGHTS[i];
    if (roll <= 0) return SLOT_SYMBOLS[i];
  }
  return SLOT_SYMBOLS[0];
}

export interface SlotResult {
  reels: [string, string, string];
  multiplier: number;
}

export function spinSlots(): SlotResult {
  const reels: [string, string, string] = [weightedSlotSymbol(), weightedSlotSymbol(), weightedSlotSymbol()];
  let multiplier = 0;
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    multiplier = reels[0] === '7️⃣' ? 20 : reels[0] === '💎' ? 10 : 5;
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    multiplier = 1.5;
  }
  return { reels, multiplier };
}

// ── Blackjack ────────────────────────────────────────────────────────────

export type Suit = '♠' | '♥' | '♦' | '♣';
export interface Card {
  rank: string;
  suit: Suit;
}

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

export function freshShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function cardLabel(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      total += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export interface BlackjackSession {
  deck: Card[];
  player: Card[];
  dealer: Card[];
  bet: number;
  finished: boolean;
}

export function startBlackjack(bet: number): BlackjackSession {
  const deck = freshShuffledDeck();
  const player = [deck.pop()!, deck.pop()!];
  const dealer = [deck.pop()!, deck.pop()!];
  return { deck, player, dealer, bet, finished: false };
}

export function playerHit(session: BlackjackSession): void {
  session.player.push(session.deck.pop()!);
}

export interface BlackjackOutcome {
  result: 'player_bust' | 'dealer_bust' | 'player_win' | 'dealer_win' | 'push' | 'blackjack';
  payout: number; // net change to wallet (can be negative)
}

export function resolveDealerAndSettle(session: BlackjackSession): BlackjackOutcome {
  session.finished = true;
  const playerTotal = handValue(session.player);
  if (playerTotal > 21) return { result: 'player_bust', payout: -session.bet };

  if (session.player.length === 2 && playerTotal === 21) {
    return { result: 'blackjack', payout: Math.floor(session.bet * 1.5) };
  }

  while (handValue(session.dealer) < 17) session.dealer.push(session.deck.pop()!);
  const dealerTotal = handValue(session.dealer);

  if (dealerTotal > 21) return { result: 'dealer_bust', payout: session.bet };
  if (dealerTotal > playerTotal) return { result: 'dealer_win', payout: -session.bet };
  if (dealerTotal < playerTotal) return { result: 'player_win', payout: session.bet };
  return { result: 'push', payout: 0 };
}
