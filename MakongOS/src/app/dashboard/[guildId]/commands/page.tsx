import { prisma } from '../../../../database/prisma';
import { modules } from '../../../../bot/registry';
import { CommandManagerTable } from '../../../../components/dashboard/forms/CommandManagerTable';

export default async function CommandsPage({ params }: { params: { guildId: string } }) {
  const allCommands = modules.flatMap((m) => (m.commands ?? []).map((c) => ({ name: c.data.name, description: c.data.description, module: m.name })));
  const overrides = await prisma.commandConfig.findMany({ where: { guildId: params.guildId } });
  const overrideMap = new Map(overrides.map((o) => [o.name, o.enabled]));
  const commands = allCommands.map((c) => ({ ...c, enabled: overrideMap.get(c.name) ?? true }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Command Manager</h1>
        <p className="text-discord-muted">Enable or disable individual slash commands on this server.</p>
      </div>
      <CommandManagerTable guildId={params.guildId} initialCommands={commands} />
    </div>
  );
}
