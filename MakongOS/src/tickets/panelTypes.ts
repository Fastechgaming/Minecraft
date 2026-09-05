export interface PanelEmbedData {
  title?: string;
  description?: string;
  color?: number;
  thumbnailUrl?: string;
  footerText?: string;
}

export type PanelComponentRow =
  | { type: 'buttons'; optionIds: string[] }
  | { type: 'select'; placeholder: string; optionIds: string[] };

export const MAX_PANEL_ROWS = 5;
export const MAX_BUTTONS_PER_ROW = 5;

export interface TicketQuestion {
  id: string;
  label: string;
  helperText?: string;
  type: 'short' | 'paragraph';
  required: boolean;
  active: boolean;
  minLength?: number;
  maxLength?: number;
}

export const OPENER_PERMISSION_KEYS = ['addReactions', 'attachFiles', 'embedLinks', 'sendVoiceMessages', 'useExternalEmojis'] as const;
export type OpenerPermissionKey = (typeof OPENER_PERMISSION_KEYS)[number];
export type OpenerPermissionOverrides = Partial<Record<OpenerPermissionKey, boolean>>;

export const OPENER_PERMISSION_LABELS: Record<OpenerPermissionKey, string> = {
  addReactions: 'Add Reactions',
  attachFiles: 'Attach Files & Upload Images',
  embedLinks: 'Embed Links',
  sendVoiceMessages: 'Send Voice Messages',
  useExternalEmojis: 'Use External Emoji'
};

export function parsePanelEmbeds(json: unknown): PanelEmbedData[] {
  return Array.isArray(json) ? (json as PanelEmbedData[]) : [];
}

export function parsePanelComponents(json: unknown): PanelComponentRow[] {
  return Array.isArray(json) ? (json as PanelComponentRow[]) : [];
}

export function parseQuestions(json: unknown): TicketQuestion[] {
  return Array.isArray(json) ? (json as TicketQuestion[]) : [];
}

export function parseOpenerOverrides(json: unknown): OpenerPermissionOverrides {
  return json && typeof json === 'object' && !Array.isArray(json) ? (json as OpenerPermissionOverrides) : {};
}

/** Substitutes {TICKET_NUMBER}, {USER}, {USERNAME} in a name-format template (channel names only allow lowercase/hyphens, applied by the caller). */
export function formatTicketChannelName(template: string | null | undefined, vars: { number: number; username: string }): string {
  const t = template && template.trim() ? template : 'ticket-{TICKET_NUMBER}';
  return t.replace(/\{TICKET_NUMBER\}/gi, String(vars.number)).replace(/\{USERNAME\}/gi, vars.username);
}
