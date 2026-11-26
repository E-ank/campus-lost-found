import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function sanitizeNextPath(nextParam: string | undefined): string {
  if (!nextParam || !nextParam.startsWith('/') || nextParam.startsWith('//') || nextParam.includes('\\')) {
    return '/';
  }
  return nextParam;
}

function redirectWithStateCleanup(targetUrl: string): NextResponse {
  const response = NextResponse.redirect(targetUrl);
  response.cookies.delete('google_oauth_state');
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError || !code || !state) {
    return redirectWithStateCleanup(`${origin}/login?error=google_cancelled`);
  }

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get('google_oauth_state')?.value;
  if (!rawCookie) {
    return redirectWithStateCleanup(`${origin}/login?error=oauth_state_missing`);
  }

  let savedState = '';
  let rawNonce = '';
  let nextPath = '/';
  try {
    const parsed = JSON.parse(rawCookie) as {
      state?: string;
      rawNonce?: string;
      next?: string;
    };
    savedState = parsed.state || '';
    rawNonce = parsed.rawNonce || '';
    nextPath = sanitizeNextPath(parsed.next);
  } catch {
    return redirectWithStateCleanup(`${origin}/login?error=oauth_state_invalid`);
  }

  if (!savedState || savedState !== state) {
    return redirectWithStateCleanup(`${origin}/login?error=oauth_state_mismatch`);
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectWithStateCleanup(`${origin}/login?error=google_secret_missing`);
  }

  // Tukar authorization code dengan id_token dari Google disertai batas waktu.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let tokenRes: Response;
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
  } catch (err) {
    console.error('Google token exchange request error:', err);
    return redirectWithStateCleanup(`${origin}/login?error=google_token_failed`);
  } finally {
    clearTimeout(timer);
  }

  if (!tokenRes.ok) {
    console.error('Google token exchange failed:', await tokenRes.text());
    return redirectWithStateCleanup(`${origin}/login?error=google_token_failed`);
  }

  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  if (!tokenJson.id_token) {
    return redirectWithStateCleanup(`${origin}/login?error=google_id_token_missing`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: tokenJson.id_token,
    ...(rawNonce ? { nonce: rawNonce } : {}),
  });

  if (error || !data.user) {
    console.error('Supabase signInWithIdToken failed:', error?.message);
    return redirectWithStateCleanup(`${origin}/login?error=supabase_google_signin_failed`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) {
    const userMeta = data.user.user_metadata || {};
    const fallbackName =
      userMeta.full_name ||
      userMeta.name ||
      data.user.email?.split('@')[0] ||
      'Mahasiswa';
    const avatarUrl = userMeta.avatar_url || userMeta.picture || null;

    const { error: upsertErr } = await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        role: 'MAHASISWA',
        role_label: 'Mahasiswa',
        name: fallbackName,
        identifier: '-',
        id_type: 'NIM',
        department: 'Belum diisi',
        phone: '-',
        avatar_bg: 'bg-blue-600',
        avatar_url: avatarUrl,
        email_personal: data.user.email ?? '',
        must_change_password: false,
        profile_completed: false,
        is_active: true,
      },
      { onConflict: 'id' }
    );
    if (upsertErr) {
      console.warn('Google callback profile upsert warning:', upsertErr.message);
    }
  }

  return redirectWithStateCleanup(`${origin}${nextPath}`);
}
