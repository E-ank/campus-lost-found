import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function sanitizeNextPath(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith('/') || nextParam.startsWith('//')) {
    return '/';
  }
  return nextParam;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const next = sanitizeNextPath(url.searchParams.get('next'));

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Fallback otomatis ke Supabase OAuth jika GOOGLE_CLIENT_SECRET belum diisi di environment
  if (!clientId || !clientSecret) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    if (!error && data?.url) {
      return NextResponse.redirect(data.url);
    }
    return NextResponse.redirect(`${origin}/login?error=google_oauth_not_configured`);
  }

  // Buat state (anti-CSRF) dan pasangan nonce (raw untuk Supabase, SHA-256 untuk Google)
  const state = crypto.randomBytes(16).toString('hex');
  const rawNonce = crypto.randomBytes(16).toString('hex');
  const hashedNonce = crypto.createHash('sha256').update(rawNonce).digest('hex');

  const redirectUri = `${origin}/auth/google/callback`;
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('prompt', 'select_account');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('nonce', hashedNonce);

  const response = NextResponse.redirect(googleAuthUrl.toString());
  response.cookies.set(
    'google_oauth_state',
    JSON.stringify({ state, rawNonce, next }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      path: '/',
      maxAge: 600,
    }
  );

  return response;
}
