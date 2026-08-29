import { prisma } from '../../../../database/prisma';
import { AutomationManager } from '../../../../components/dashboard/forms/AutomationManager';

export default async function AutomationPage({ params }: { params: { guildId: string } }) {
  const rules = await prisma.automationRule.findMany({ where: { guildId: params.guildId }, orderBy: { createdAt: 'desc' } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Automation</h1>
        <p className="text-discord-muted">WHEN a trigger fires and conditions match, THEN run one or more actions.</p>
      </div>
      <AutomationManager
        guildId={params.guildId}
        initial={rules.map((r) => ({
          id: r.id,
          name: r.name,
          enabled: r.enabled,
          trigger: r.trigger,
          conditions: JSON.stringify(r.conditions ?? [], null, 2),
          actions: JSON.stringify(r.actions ?? [], null, 2)
        }))}
      />
    </div>
  );
}
