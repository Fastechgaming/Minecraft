import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { authOptions } from '../../../lib/auth';
import { getGuildRole } from '../../../lib/guildAccess';
import { prisma } from '../../../database/prisma';
import { DashboardShell } from '../../../components/dashboard/DashboardShell';

export default async function GuildLayout({ children, params }: { children: ReactNode; params: { guildId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.userId) redirect('/');

  const role = await getGuildRole(session.accessToken, session.userId, params.guildId);
  if (!role) redirect('/dashboard');

  const guild = await prisma.guild.findUnique({ where: { id: params.guildId } });
  if (!guild) redirect('/dashboard');

  return (
    <DashboardShell
      guildId={params.guildId}
      guildName={guild.name}
      role={role}
      userName={session.user?.name ?? 'User'}
      userAvatar={session.user?.image ?? null}
    >
      {children}
    </DashboardShell>
  );
}
