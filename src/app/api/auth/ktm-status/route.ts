import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const admin =
      serviceKey && url
        ? createAdminClient(url, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : null;
    const db = admin ?? supabase;

    // Status ktm_verified hanya dipercaya dari tabel public.profiles, bukan user_metadata klien.
    const { data: profile } = await db
      .from('profiles')
      .select('ktm_verified, ktm_url')
      .eq('id', user.id)
      .maybeSingle();

    const ktmVerified = Boolean(profile?.ktm_verified);
    let ktmUrl: string | null = (profile?.ktm_url as string | null | undefined) ?? null;
    let ktmRejected = false;

    if (!ktmVerified && !ktmUrl) {
      if (admin) {
        const { data: adminUser } = await admin.auth.admin.getUserById(user.id);
        ktmRejected = Boolean(adminUser?.user?.user_metadata?.ktm_rejected);
      } else {
        ktmRejected = Boolean((user.user_metadata as Record<string, unknown> | undefined)?.ktm_rejected);
      }
    }

    if (!ktmUrl && !ktmRejected) {
      try {
        const storage = db.storage;
        const { data: ktmCardFiles } = await storage.from('ktm-cards').list(user.id, {
          limit: 20,
          sortBy: { column: 'name', order: 'desc' },
        });
        const cardFile = ktmCardFiles?.[0];
        if (cardFile) {
          ktmUrl = storage.from('ktm-cards').getPublicUrl(`${user.id}/${cardFile.name}`).data.publicUrl;
        } else {
          const { data: avatarFiles } = await storage.from('avatars').list(user.id, {
            limit: 50,
            sortBy: { column: 'name', order: 'desc' },
          });
          const ktmFile = avatarFiles?.find((f) => f.name.startsWith('ktm-'));
          if (ktmFile) {
            ktmUrl = storage.from('avatars').getPublicUrl(`${user.id}/${ktmFile.name}`).data.publicUrl;
          }
        }
      } catch {
        // Abaikan jika bucket belum tersedia
      }
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      ktmVerified,
      ktmUrl,
      ktmRejected,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal memeriksa status KTM' },
      { status: 500 }
    );
  }
}
