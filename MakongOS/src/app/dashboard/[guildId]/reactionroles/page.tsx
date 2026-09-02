import { prisma } from '../../../../database/prisma';

export default async function ReactionRolesPage({ params }: { params: { guildId: string } }) {
  const panels = await prisma.reactionRolePanel.findMany({ where: { guildId: params.guildId }, orderBy: { createdAt: 'desc' } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reaction Roles</h1>
        <p className="text-discord-muted">Manage panels with `/reactionrole new`, `addrole`, and `post` in Discord.</p>
      </div>
      <div className="flex flex-col gap-2">
        {panels.length === 0 && <p className="text-sm text-discord-muted">No panels yet.</p>}
        {panels.map((p) => {
          const options = (p.options as unknown as { label: string }[]) ?? [];
          return (
            <div key={p.id} className="card p-4">
              <div className="font-medium text-white">{p.title}</div>
              <div className="text-xs text-discord-muted">{options.length} role option(s) {p.messageId ? '· Posted' : '· Not posted yet'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
