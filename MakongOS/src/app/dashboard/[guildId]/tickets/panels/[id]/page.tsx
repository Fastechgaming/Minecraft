import { notFound } from 'next/navigation';
import { prisma } from '../../../../../../database/prisma';
import { PanelDesigner } from '../../../../../../components/dashboard/forms/PanelDesigner';

export default async function PanelDesignerPage({ params }: { params: { guildId: string; id: string } }) {
  const panel = await prisma.ticketPanel.findFirst({ where: { id: params.id, guildId: params.guildId } });
  if (!panel) notFound();
  const options = await prisma.ticketCategory.findMany({ where: { panelId: params.id } });

  return <PanelDesigner guildId={params.guildId} panel={panel} initialOptions={options} />;
}
