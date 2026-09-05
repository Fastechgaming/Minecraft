import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import type { TicketPanel, TicketCategory } from '@prisma/client';
import { parsePanelEmbeds, parsePanelComponents } from './panelTypes';

export interface PanelMessagePayload {
  content?: string;
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
}

/** Builds the Discord message (embeds + button rows/dropdowns) for a saved ticket panel. */
export function buildPanelMessage(panel: TicketPanel, options: TicketCategory[]): PanelMessagePayload {
  const embedData = parsePanelEmbeds(panel.embeds);
  const embeds =
    embedData.length > 0
      ? embedData.map((e) => {
          const embed = new EmbedBuilder().setColor(e.color ?? 0x22c55e);
          if (e.title) embed.setTitle(e.title);
          if (e.description) embed.setDescription(e.description);
          if (e.thumbnailUrl) embed.setThumbnail(e.thumbnailUrl);
          if (e.footerText) embed.setFooter({ text: e.footerText });
          return embed;
        })
      : [new EmbedBuilder().setColor(0x22c55e).setTitle('Support').setDescription('Select an option below to open a ticket.')];

  const byId = new Map(options.map((o) => [o.id, o]));
  const rows = parsePanelComponents(panel.components);
  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

  for (const row of rows) {
    const rowOptions = row.optionIds.map((id) => byId.get(id)).filter((o): o is TicketCategory => !!o);
    if (rowOptions.length === 0) continue;

    if (row.type === 'buttons') {
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          rowOptions.map((o) => new ButtonBuilder().setCustomId(`ticket_open_btn_${o.id}`).setLabel(o.name).setEmoji(o.emoji).setStyle(ButtonStyle.Secondary))
        )
      );
    } else {
      const select = new StringSelectMenuBuilder()
        .setCustomId('ticket_open_select')
        .setPlaceholder(row.placeholder || 'Select an option...')
        .addOptions(
          rowOptions.map((o) => ({
            label: o.name.slice(0, 100),
            value: o.id,
            emoji: o.emoji,
            description: o.description ? o.description.slice(0, 100) : undefined
          }))
        );
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
    }
  }

  return { content: panel.content ?? undefined, embeds, components };
}
