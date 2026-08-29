/** Every GuildSettings column the dashboard is allowed to write, grouped for docs/UI reuse. */
export const EDITABLE_SETTINGS_FIELDS = [
  'prefix', 'language', 'timezone', 'embedColor',
  'logChannelId', 'modLogChannelId', 'aiEscalationChannel', 'welcomeChannelId', 'leaveChannelId', 'aiChannelIds', 'musicChannelIds',
  'staffRoleIds', 'moderatorRoleIds', 'adminRoleIds', 'defaultRoleIds', 'djRoleIds',
  'ticketCategoryId',
  'moderationEnabled', 'antiSpamEnabled', 'aiEnabled', 'musicEnabled', 'ticketsEnabled', 'levelingEnabled', 'gamesEnabled', 'welcomeEnabled', 'automationEnabled',
  'aiMode', 'aiResponseFrequency', 'aiMentionRequired', 'aiHelpDetection', 'aiCasualConversation', 'aiStaffEscalation',
  'aiMemoryEnabled', 'aiMemoryDurationHours', 'aiMaxHistoryMessages', 'aiImageUnderstanding', 'aiImageGeneration',
  'aiDailyLimit', 'aiMonthlyLimit', 'aiPerUserCooldownSec', 'aiPerChannelCooldownSec',
  'aiAutoModEnabled', 'aiAutoModHighConfidence', 'aiAutoModMedConfidence', 'aiAutoModAction',
  'spamWarnThreshold', 'spamActionThreshold', 'spamBanThreshold', 'spamWhitelistUserIds', 'spamWhitelistRoleIds', 'spamWhitelistChanIds',
  'xpPerMessage', 'xpCooldownSec', 'xpPerVoiceMin', 'xpLevelUpBase',
  'musicMaxQueue', 'musicDefaultVol'
] as const;

export type EditableSettingsField = (typeof EDITABLE_SETTINGS_FIELDS)[number];

export function pickEditableFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of EDITABLE_SETTINGS_FIELDS) {
    if (key in body) result[key] = body[key];
  }
  return result;
}
