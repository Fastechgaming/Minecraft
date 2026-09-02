import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { xpForLevel } from './xp';

const WIDTH = 934;
const HEIGHT = 282;

function roundRect(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface RankCardInput {
  username: string;
  avatarUrl: string;
  level: number;
  rank: number;
  totalXp: number;
  textXp: number;
  voiceXp: number;
  levelBase: number;
}

let fontLoaded = false;
function ensureFont() {
  if (fontLoaded) return;
  try {
    GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'RankSans');
  } catch {
    // fall back to whatever default font ships with the system — still renders correctly, just not custom.
  }
  fontLoaded = true;
}

export async function renderRankCard(input: RankCardInput): Promise<Buffer> {
  ensureFont();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGradient.addColorStop(0, '#1e1f26');
  bgGradient.addColorStop(1, '#2b2d42');
  ctx.fillStyle = bgGradient;
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 24);
  ctx.fill();

  const avatarSize = 180;
  const avatarX = 56;
  const avatarY = (HEIGHT - avatarSize) / 2;
  try {
    const avatar = await loadImage(input.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#5865f2';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#5865f2';
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  const textX = avatarX + avatarSize + 40;
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 40px RankSans, sans-serif';
  ctx.fillText(input.username, textX, 96);

  ctx.fillStyle = '#8e9297';
  ctx.font = '400 24px RankSans, sans-serif';
  ctx.fillText(`Text XP ${input.textXp.toLocaleString()} · Voice XP ${input.voiceXp.toLocaleString()}`, textX, 130);

  ctx.fillStyle = '#5865f2';
  ctx.font = '700 30px RankSans, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`RANK #${input.rank}`, WIDTH - 56, 96);
  ctx.fillStyle = '#43b581';
  ctx.fillText(`LEVEL ${input.level}`, WIDTH - 56, 132);
  ctx.textAlign = 'left';

  const barX = textX;
  const barY = 200;
  const barW = WIDTH - textX - 56;
  const barH = 28;

  const currentLevelXp = xpForLevel(input.level, input.levelBase);
  const nextLevelXp = xpForLevel(input.level + 1, input.levelBase);
  const progress = Math.max(0, Math.min(1, (input.totalXp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)));

  ctx.fillStyle = '#40444b';
  roundRect(ctx, barX, barY, barW, barH, 14);
  ctx.fill();

  const fillGradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  fillGradient.addColorStop(0, '#5865f2');
  fillGradient.addColorStop(1, '#43b581');
  ctx.fillStyle = fillGradient;
  roundRect(ctx, barX, barY, Math.max(barH, barW * progress), barH, 14);
  ctx.fill();

  ctx.fillStyle = '#dcddde';
  ctx.font = '400 18px RankSans, sans-serif';
  ctx.fillText(`${input.totalXp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP`, barX, barY + barH + 28);

  return canvas.encode('png');
}
