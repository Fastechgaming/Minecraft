'use client';

import { signIn } from 'next-auth/react';

export function SignInButton() {
  return (
    <button onClick={() => signIn('discord', { callbackUrl: '/dashboard' })} className="btn-primary px-6 py-3 text-base">
      Sign in with Discord
    </button>
  );
}
