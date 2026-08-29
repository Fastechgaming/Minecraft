import { prisma } from '../../../../../database/prisma';
import { WelcomeForm } from '../../../../../components/dashboard/forms/WelcomeForm';

export default async function WelcomePage({ params }: { params: { guildId: string } }) {
  const config = await prisma.welcomeConfig.upsert({
    where: { guildId: params.guildId },
    create: { guildId: params.guildId },
    update: {}
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome & Leave</h1>
        <p className="text-discord-muted">Customize the embed new members see, and the goodbye message when they leave.</p>
      </div>
      <WelcomeForm guildId={params.guildId} initial={config} />
    </div>
  );
}
