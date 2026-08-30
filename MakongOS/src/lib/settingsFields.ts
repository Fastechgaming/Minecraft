/** Every GuildSettings column the dashboard is allowed to write, grouped for docs/UI reuse. */
export const EDITABLE_SETTINGS_FIELDS = [
  'prefix', 'language', 'timezone', 'embedColor',
  'logChannelId', 'aiEscalationChannel', 'suggestionsChannelId', 'ticketLogChannelId', 'aiChannelIds', 'musicChannelIds',
  'staffRoleIds', 'adminRoleIds', 'djRoleIds',
  'aiEnabled', 'musicEnabled', 'ticketsEnabled', 'economyEnabled', 'funEnabled', 'suggestionsEnabled', 'giveawaysEnabled', 'levelingEnabled',
  'aiMode', 'aiResponseFrequency', 'aiMentionRequired', 'aiHelpDetection', 'aiCasualConversation', 'aiStaffEscalation',
  'aiMemoryEnabled', 'aiMemoryDurationHours', 'aiMaxHistoryMessages', 'aiImageUnderstanding', 'aiImageGeneration',
  'aiDailyLimit', 'aiMonthlyLimit', 'aiPerUserCooldownSec', 'aiPerChannelCooldownSec',
  'xpPerMessage', 'xpCooldownSec', 'xpPerVoiceMin', 'xpLevelUpBase',
  'musicMaxQueue', 'musicDefaultVol',
  'ticketMaxOpenPerUser',
  'economyCurrencySymbol', 'economyDailyAmount', 'economyBegMin', 'economyBegMax', 'economyBegCooldownSec'
] as const;

export type EditableSettingsField = (typeof EDITABLE_SETTINGS_FIELDS)[number];

export function pickEditableFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of EDITABLE_SETTINGS_FIELDS) {
    if (key in body) result[key] = body[key];
  }
  return result;
}
