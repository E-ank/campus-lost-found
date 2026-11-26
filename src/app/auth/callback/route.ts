import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function sanitizeNextPath(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith('/') || nextParam.startsWith('//') || nextParam.includes('\\')) {
    return '/';
  }
  return nextParam;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, profile_completed, identifier, department, name, role')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile) {
          const userMeta = user.user_metadata || {};
          const fallbackName =
            userMeta.full_name ||
            userMeta.name ||
            user.email?.split('@')[0] ||
            'Mahasiswa';
          const avatarUrl = userMeta.avatar_url || userMeta.picture || null;

          const { error: upsertErr } = await supabase.from('profiles').upsert(
            {
              id: user.id,
              role: 'MAHASISWA',
              role_label: 'Mahasiswa',
              name: fallbackName,
              identifier: '-',
              id_type: 'NIM',
              department: 'Belum diisi',
              phone: '-',
              avatar_bg: 'bg-blue-600',
              avatar_url: avatarUrl,
              email_personal: user.email ?? '',
              must_change_password: false,
              profile_completed: false,
              is_active: true,
            },
            { onConflict: 'id' }
          );
          if (upsertErr) {
            console.warn('Auth callback profile upsert warning:', upsertErr.message);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
