import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { getGuildRole } from './guildAccess';
import { hasAtLeastRole, type DashboardRole } from '../services/permissions';

interface AuthorizedRequest {
  userId: string;
  role: DashboardRole;
}

export async function authorizeGuildRequest(guildId: string, minRole: DashboardRole): Promise<AuthorizedRequest | null> {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.userId) return null;

  const role = await getGuildRole(session.accessToken, session.userId, guildId);
  if (!role || !hasAtLeastRole(role, minRole)) return null;

  return { userId: session.userId, role };
}
