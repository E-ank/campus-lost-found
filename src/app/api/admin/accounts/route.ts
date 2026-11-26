import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { toSyntheticEmail } from '@/lib/auth-identifier';
import { DEFAULT_ACCOUNT_PASSWORD } from '@/lib/accounts';
import type { BulkAccountRow, RegisteredAccount, UserRole } from '@/types';

const MAX_BULK_ROWS = 200;

function formatAccountDate(value: string | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Ambil seluruh daftar akun lengkap untuk Superadmin aktif, dilengkapi penelusuran foto KTM.
export async function GET() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 });
  }

  const { data: requester } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .single();

  if (requester?.role !== 'SUPERADMIN' || requester?.is_active === false) {
    return NextResponse.json({ error: 'Akses ditolak: khusus Superadmin aktif.' }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Kunci server Supabase belum dikonfigurasi di .env.local.' },
      { status: 500 }
    );
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles, error: profileErr } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // Ambil seluruh pengguna auth dengan paginasi agar akun > 1.000 tetap tercakup.
  const authUsersMap = new Map<string, { id: string; email?: string; user_metadata?: Record<string, unknown> }>();
  for (let page = 1; page <= 10; page += 1) {
    const { data: authPage } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = authPage?.users ?? [];
    for (const u of users) {
      authUsersMap.set(u.id, u);
    }
    if (users.length < 1000) break;
  }

  const accounts: RegisteredAccount[] = await Promise.all(
    (profiles ?? []).map(async (row) => {
      const authUser = authUsersMap.get(row.id);
      const userMeta = (authUser?.user_metadata || {}) as Record<string, unknown>;

      let ktmUrl: string | null = (row.ktm_url as string | undefined) || (userMeta.ktm_url as string | undefined) || null;
      const ktmVerified = Boolean(row.ktm_verified);
      const ktmRejected = Boolean(userMeta.ktm_rejected);

      if (!ktmUrl && !ktmRejected) {
        try {
          const { data: cardFiles } = await admin.storage.from('ktm-cards').list(row.id, {
            limit: 10,
            sortBy: { column: 'created_at', order: 'desc' },
          });
          if (cardFiles && cardFiles.length > 0) {
            ktmUrl = admin.storage.from('ktm-cards').getPublicUrl(`${row.id}/${cardFiles[0].name}`).data.publicUrl;
          } else {
            const { data: files } = await admin.storage.from('avatars').list(row.id, {
              limit: 10,
              sortBy: { column: 'created_at', order: 'desc' },
            });
            const ktmFiles = files?.filter((f) => f.name.startsWith('ktm-')) ?? [];
            if (ktmFiles.length > 0) {
              const latest = ktmFiles.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
              ktmUrl = admin.storage.from('avatars').getPublicUrl(`${row.id}/${latest.name}`).data.publicUrl;
            }
          }
        } catch {
          // ignore
        }
      }

      return {
        id: row.id,
        name: row.name,
        identifier: row.identifier,
        role: row.role as UserRole,
        roleLabel: row.role_label,
        idType: row.id_type,
        department: row.department ?? '-',
        phone: row.phone ?? '-',
        emailPersonal: row.email_personal ?? authUser?.email ?? '',
        avatarUrl: row.avatar_url ?? null,
        mustChangePassword: Boolean(row.must_change_password),
        profileCompleted: Boolean(row.profile_completed),
        isActive: row.is_active !== false,
        createdAt: formatAccountDate(row.created_at),
        ktmUrl,
        ktmVerified,
      };
    })
  );

  return NextResponse.json({ accounts });
}

// Penerbitan akun massal ala SIAKAD. Hanya boleh dipanggil Superadmin aktif.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 });
  }

  const { data: requester } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .single();

  if (requester?.role !== 'SUPERADMIN' || requester?.is_active === false) {
    return NextResponse.json({ error: 'Akses ditolak: khusus Superadmin aktif.' }, { status: 403 });
  }

  let body: { rows?: BulkAccountRow[] };
  try {
    body = (await request.json()) as { rows?: BulkAccountRow[] };
  } catch {
    return NextResponse.json({ error: 'Format data impor tidak valid.' }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Tidak ada akun yang dikirim.' }, { status: 400 });
  }
  if (rows.length > MAX_BULK_ROWS) {
    return NextResponse.json(
      { error: `Maksimal ${MAX_BULK_ROWS} baris per impor massal.` },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Kunci server Supabase belum dikonfigurasi di .env.local.' },
      { status: 500 }
    );
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const created: string[] = [];
  const failed: { identifier: string; reason: string }[] = [];

  for (const row of rows) {
    const rawIdentifier = typeof row?.identifier === 'string' ? row.identifier : '';
    const rawName = typeof row?.name === 'string' ? row.name : '';
    const identifier = rawIdentifier.trim().toUpperCase();
    const name = rawName.trim();
    const department = typeof row?.department === 'string' && row.department.trim()
      ? row.department.trim()
      : 'Belum diisi';

    if (!identifier || !name) {
      if (rawIdentifier || rawName) {
        failed.push({ identifier: identifier || '(kosong)', reason: 'NIM dan nama wajib diisi.' });
      }
      continue;
    }

    const { data: userData, error } = await admin.auth.admin.createUser({
      email: toSyntheticEmail(identifier),
      password: DEFAULT_ACCOUNT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        identifier,
        name,
        role: 'MAHASISWA',
        role_label: 'Mahasiswa',
        id_type: 'NIM',
        department,
        must_change_password: true,
      },
    });

    if (error || !userData.user) {
      failed.push({ identifier, reason: error?.message ?? 'Gagal membuat akun.' });
      continue;
    }

    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: userData.user.id,
        identifier,
        name,
        role: 'MAHASISWA',
        role_label: 'Mahasiswa',
        id_type: 'NIM',
        department,
        avatar_bg: 'bg-blue-600',
        must_change_password: true,
        profile_completed: false,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    if (profileError) {
      // Rollback akun auth agar tidak menjadi akun yatim tanpa profil.
      await admin.auth.admin.deleteUser(userData.user.id).catch(() => undefined);
      failed.push({ identifier, reason: profileError.message });
      continue;
    }

    created.push(identifier);
  }

  return NextResponse.json({
    created,
    failed,
    defaultPassword: DEFAULT_ACCOUNT_PASSWORD,
  });
}
