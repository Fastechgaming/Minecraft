import { prisma } from '../database/prisma';
import { getGuildSettings } from '../database/settingsCache';
import { createLogger } from '../services/logger';
import type { Client } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

const log = createLogger('automation');

export type AutomationTrigger =
  | 'member_join'
  | 'member_leave'
  | 'ai_high_confidence_spam'
  | 'message_contains'
  | 'role_added'
  | 'command_used'
  | 'scheduled';

interface TriggerPayload {
  guildId: string;
  userId?: string;
  channelId?: string;
  data?: Record<string, unknown>;
}

interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'not_equals';
  value: string;
}

interface RuleAction {
  type: 'send_message' | 'add_role' | 'remove_role' | 'timeout' | 'notify_staff' | 'create_ticket';
  params: Record<string, unknown>;
}

function evaluateConditions(conditions: RuleCondition[] | undefined, payload: TriggerPayload): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((cond) => {
    const value = String((payload.data as Record<string, unknown> | undefined)?.[cond.field] ?? '');
    switch (cond.operator) {
      case 'equals':
        return value === cond.value;
      case 'not_equals':
        return value !== cond.value;
      case 'contains':
        return value.toLowerCase().includes(cond.value.toLowerCase());
      default:
        return false;
    }
  });
}

async function runAction(client: Client, action: RuleAction, payload: TriggerPayload): Promise<void> {
  const guild = await client.guilds.fetch(payload.guildId).catch(() => null);
  if (!guild) return;

  switch (action.type) {
    case 'send_message': {
      const channelId = (action.params.channelId as string) ?? payload.channelId;
      if (!channelId) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased()) {
        const content = String(action.params.content ?? '').replace('{user}', payload.userId ? `<@${payload.userId}>` : '');
        await channel.send({ content }).catch(() => undefined);
      }
      break;
    }
    case 'add_role':
    case 'remove_role': {
      if (!payload.userId) return;
      const member = await guild.members.fetch(payload.userId).catch(() => null);
      const roleId = action.params.roleId as string;
      if (!member || !roleId) return;
      if (action.type === 'add_role') await member.roles.add(roleId).catch(() => undefined);
      else await member.roles.remove(roleId).catch(() => undefined);
      break;
    }
    case 'timeout': {
      if (!payload.userId) return;
      const member = await guild.members.fetch(payload.userId).catch(() => null);
      const durationSec = Number(action.params.durationSec ?? 600);
      await member?.timeout(durationSec * 1000, 'Automation rule').catch(() => undefined);
      break;
    }
    case 'notify_staff': {
      const settings = await getGuildSettings(payload.guildId);
      const channelId = settings.modLogChannelId ?? settings.logChannelId;
      if (!channelId) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0xf0b232)
          .setTitle('🤖 Automation Alert')
          .setDescription(String(action.params.message ?? 'An automation rule fired.'))
          .setTimestamp(new Date());
        await channel.send({ embeds: [embed] }).catch(() => undefined);
      }
      break;
    }
    case 'create_ticket':
      // Delegated to the tickets module to avoid a circular import; automation
      // only needs to notify staff here, actual ticket creation is triggered
      // via the moderation/AI escalation path directly.
      break;
  }
}

export const automationEngine = {
  async trigger(client: Client, trigger: AutomationTrigger, payload: TriggerPayload): Promise<void> {
    try {
      const settings = await getGuildSettings(payload.guildId);
      if (!settings.automationEnabled) return;

      const rules = await prisma.automationRule.findMany({
        where: { guildId: payload.guildId, trigger, enabled: true }
      });

      for (const rule of rules) {
        if (!evaluateConditions(rule.conditions as unknown as RuleCondition[] | undefined, payload)) continue;
        const actions = (rule.actions as unknown as RuleAction[] | undefined) ?? [];
        for (const action of actions) {
          await runAction(client, action, payload);
        }
      }
    } catch (err) {
      log.error(`Failed running automation trigger ${trigger}`, err);
    }
  }
};
