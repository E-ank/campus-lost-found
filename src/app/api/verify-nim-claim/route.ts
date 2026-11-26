import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function normalizeIdentifier(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function normalizePhone(str: string): string {
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return `0${digits.slice(2)}`;
  return digits;
}

// Pastikan URL KTM berasal dari folder KTM milik pengguna sendiri di proyek Supabase ini.
function isOwnedKtmStorageUrl(urlValue: string, supabaseUrl: string | undefined, userId: string): boolean {
  if (!urlValue || !supabaseUrl) return false;
  try {
    const parsed = new URL(urlValue);
    const base = new URL(supabaseUrl);
    if (parsed.origin !== base.origin) return false;
    return (
      parsed.pathname.includes(`/storage/v1/object/public/ktm-cards/${userId}/`) ||
      parsed.pathname.includes(`/storage/v1/object/public/avatars/${userId}/ktm-`)
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const body = await request.json();
    const { identifier, phone, ktmUrl, isNewKtmUpload } = body;

    const trimmedNim = normalizeIdentifier(String(identifier || ''));
    const normalizedPhone = normalizePhone(String(phone || ''));

    if (!trimmedNim || trimmedNim === '-') {
      return NextResponse.json(
        {
          conflict: false,
          allowed: false,
          message: 'Nomor identitas wajib diisi untuk menjaga aturan 1 akun = 1 identitas.',
        },
        { status: 400 }
      );
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

    const { data: ownProfile } = await db
      .from('profiles')
      .select('id, role, is_active, identifier, name, ktm_verified, ktm_url')
      .eq('id', user.id)
      .maybeSingle();

    if (ownProfile?.is_active === false) {
      return NextResponse.json({ error: 'Akun dinonaktifkan.' }, { status: 403 });
    }

    const userRole = (ownProfile?.role as string | undefined) || 'MAHASISWA';
    const isMahasiswa = userRole === 'MAHASISWA';

    // Sumber kebenaran status verifikasi hanya dari database `profiles`.
    const ownVerified = Boolean(ownProfile?.ktm_verified);
    const ownCurrentNim = normalizeIdentifier(String(ownProfile?.identifier || ''));
    if (ownVerified && ownCurrentNim && ownCurrentNim !== trimmedNim) {
      return NextResponse.json(
        {
          conflict: true,
          allowed: false,
          reason: 'IDENTITY_LOCKED',
          message:
            'NIM pada akun yang sudah terverifikasi terkunci permanen. Hubungi Admin kampus jika ada kesalahan data.',
        },
        { status: 403 }
      );
    }

    // Cek aturan 1 Akun = 1 Identitas tanpa membocorkan email akun lain.
    const { data: existingProfiles, error: searchError } = await db
      .from('profiles')
      .select('id')
      .ilike('identifier', trimmedNim)
      .neq('id', user.id)
      .limit(1);

    if (searchError) {
      console.error('Error searching profile identifier:', searchError);
      return NextResponse.json({ error: searchError.message }, { status: 500 });
    }

    if (existingProfiles && existingProfiles.length > 0) {
      return NextResponse.json(
        {
          conflict: true,
          allowed: false,
          reason: 'NIM_ALREADY_REGISTERED',
          message: `Nomor identitas ${trimmedNim} sudah terdaftar pada akun lain. Setiap civitas hanya boleh memiliki 1 akun. Silakan masuk menggunakan akun tersebut atau hubungi Admin kampus.`,
        },
        { status: 409 }
      );
    }

    // Cek duplikasi nomor WhatsApp dengan query terarah.
    if (normalizedPhone.length >= 9) {
      const suffix = normalizedPhone.slice(-8);
      const { data: phoneProfiles } = await db
        .from('profiles')
        .select('id, phone')
        .neq('id', user.id)
        .neq('phone', '-')
        .ilike('phone', `%${suffix}%`)
        .limit(25);

      const duplicatePhoneOwner = (phoneProfiles ?? []).find(
        (p) => normalizePhone(String(p.phone || '')) === normalizedPhone
      );

      if (duplicatePhoneOwner) {
        return NextResponse.json(
          {
            conflict: true,
            allowed: false,
            reason: 'PHONE_ALREADY_REGISTERED',
            message:
              'Nomor WhatsApp ini sudah terhubung dengan akun lain. Gunakan akun Anda yang sudah terdaftar atau hubungi Admin kampus.',
          },
          { status: 409 }
        );
      }
    }

    // Untuk non-mahasiswa (Dosen/Satpam/Superadmin), akun diterbitkan kampus sehingga tidak memerlukan KTM.
    if (!isMahasiswa) {
      return NextResponse.json({
        conflict: false,
        allowed: true,
        autoVerified: true,
        serverUpdated: false,
        message: 'Identitas akun valid.',
      });
    }

    const safeKtmUrl = typeof ktmUrl === 'string' && ktmUrl.trim() ? ktmUrl.trim() : '';
    if (safeKtmUrl && !isOwnedKtmStorageUrl(safeKtmUrl, url, user.id)) {
      return NextResponse.json(
        {
          conflict: false,
          allowed: false,
          message: 'URL berkas KTM tidak valid atau bukan milik akun Anda.',
        },
        { status: 400 }
      );
    }

    // Jangan pernah meloloskan ktm_verified dari hasil OCR kiriman klien; unggahan KTM baru menunggu verifikasi Admin.
    const autoVerified = Boolean(ownVerified && !isNewKtmUpload);

    let serverUpdated = false;
    if (admin && safeKtmUrl) {
      const profileUpdate: Record<string, unknown> = {
        ktm_url: safeKtmUrl,
        ktm_verified: autoVerified,
        updated_at: new Date().toISOString(),
      };
      const { error: adminProfileErr } = await admin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (!adminProfileErr || !adminProfileErr.message.includes('ktm_')) {
        serverUpdated = !adminProfileErr;
      }

      const { error: metaErr } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ktm_url: safeKtmUrl,
          ktm_verified: autoVerified,
          ktm_rejected: false,
        },
      });
      if (metaErr) {
        console.warn('verify-nim-claim metadata sync warning:', metaErr.message);
      }
    }

    return NextResponse.json({
      conflict: false,
      allowed: true,
      autoVerified,
      serverUpdated,
      message: autoVerified
        ? `Identitas NIM ${trimmedNim} terverifikasi.`
        : 'NIM tersedia. Dokumen KTM/SIAKAD akan ditinjau oleh Admin kampus untuk menyelesaikan verifikasi.',
    });
  } catch (error) {
    console.error('Error verifying NIM claim:', error);
    return NextResponse.json(
      {
        error: 'Gagal memverifikasi kepemilikan NIM.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
