import type { TextChannel, ThreadChannel } from 'discord.js';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function buildHtmlTranscript(channel: TextChannel | ThreadChannel, title: string): Promise<string> {
  const messages: import('discord.js').Message[] = [];
  let before: string | undefined;
  for (let i = 0; i < 20; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  messages.reverse();

  const rows = messages
    .map((m) => {
      const time = m.createdAt.toLocaleString();
      const avatar = m.author.displayAvatarURL({ extension: 'png', size: 64 });
      const content = escapeHtml(m.content || '').replace(/\n/g, '<br>');
      const attachments = [...m.attachments.values()]
        .map((a) => (a.contentType?.startsWith('image/') ? `<img src="${a.url}" class="attachment-img">` : `<a href="${a.url}">${escapeHtml(a.name)}</a>`))
        .join('');
      const embeds = m.embeds
        .map((e) => `<div class="embed">${e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : ''}${e.description ? `<div>${escapeHtml(e.description)}</div>` : ''}</div>`)
        .join('');
      return `<div class="msg"><img class="avatar" src="${avatar}"><div class="body"><div class="meta"><span class="author">${escapeHtml(m.author.tag)}</span><span class="time">${time}</span></div><div class="content">${content}</div>${attachments}${embeds}</div></div>`;
    })
    .join('\n');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{background:#313338;color:#dbdee1;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;}
h1{color:#fff;}
.msg{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #3f4147;}
.avatar{width:40px;height:40px;border-radius:50%;}
.meta{display:flex;gap:8px;align-items:baseline;}
.author{color:#fff;font-weight:600;}
.time{color:#949ba4;font-size:12px;}
.content{white-space:pre-wrap;word-break:break-word;}
.attachment-img{max-width:320px;border-radius:6px;margin-top:4px;display:block;}
.embed{border-left:4px solid #5865f2;background:#2b2d31;padding:8px 12px;border-radius:4px;margin-top:6px;max-width:520px;}
.embed-title{font-weight:600;color:#fff;}
</style></head>
<body><h1>${escapeHtml(title)}</h1>${rows}</body></html>`;
}
