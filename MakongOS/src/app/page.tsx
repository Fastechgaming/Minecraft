import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../lib/auth';
import { SignInButton } from '../components/SignInButton';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-discord-blurple text-3xl font-bold text-white shadow-panel">
          M
        </div>
        <h1 className="text-3xl font-bold text-white">MakongOS</h1>
        <p className="max-w-md text-discord-muted">
          The full Discord staff system for your Minecraft community — moderation, AI assistance, music and more,
          all managed from one dashboard.
        </p>
      </div>
      <SignInButton />
    </main>
  );
}
