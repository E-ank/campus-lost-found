import { NextResponse } from 'next/server';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isUserRole, ROLE_LABELS } from '@/lib/roles';
import { DEFAULT_ACCOUNT_PASSWORD } from '@/lib/accounts';

const BAN_DURATION = '876000h';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PatchBody =
  | { action: 'role'; role: string }
  | { action: 'reset-password' }
  | { action: 'status'; isActive: boolean }
  | { action: 'verify-ktm'; approved: boolean; clearDocument?: boolean };

interface ProfileRow {
  id: string;
  name: string;
  role: string;
  is_active?: boolean | null;
  ktm_url?: string | null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function statusColumnError(message: string): string {
  if (message.toLowerCase().includes('is_active')) {
    return 'Kolom status akun belum tersedia. Jalankan migrasi admin_panel.sql di Supabase SQL Editor.';
  }
  return `Status akun gagal disimpan: ${message}`;
}

async function hasOtherActiveSuperadmin(
  admin: SupabaseClient,
  targetId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, is_active')
    .eq('role', 'SUPERADMIN')
    .neq('id', targetId);

  if (error) {
    if (!error.message.toLowerCase().includes('is_active')) {
      return false;
    }

    const fallback = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'SUPERADMIN')
      .neq('id', targetId);

    return (fallback.data ?? []).length > 0;
  }

  return (data ?? []).some((row) => row.is_active !== false);
}

// Hapus berkas KTM lama di storage agar tidak kembali muncul lewat fallback scan.
async function clearUserKtmStorageFiles(admin: SupabaseClient, targetId: string) {
  try {
    const { data: ktmCardFiles } = await admin.storage.from('ktm-cards').list(targetId, { limit: 50 });
    const paths = (ktmCardFiles ?? []).map((f) => `${targetId}/${f.name}`);
    if (paths.length > 0) {
      await admin.storage.from('ktm-cards').remove(paths);
    }
  } catch {
    // Abaikan jika bucket belum ada
  }

  try {
    const { data: avatarFiles } = await admin.storage.from('avatars').list(targetId, { limit: 50 });
    const ktmPaths = (avatarFiles ?? [])
      .filter((f) => f.name.startsWith('ktm-'))
      .map((f) => `${targetId}/${f.name}`);
    if (ktmPaths.length > 0) {
      await admin.storage.from('avatars').remove(ktmPaths);
    }
  } catch {
    // Abaikan
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return errorResponse('ID akun tidak valid.', 400);
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return errorResponse('Tidak terautentikasi.', 401);
  }

  const { data: requester } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (requester?.role !== 'SUPERADMIN' || requester?.is_active === false) {
    return errorResponse('Akses ditolak: khusus Superadmin aktif.', 403);
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return errorResponse('Format permintaan tidak valid.', 400);
  }

  if (
    body.action !== 'role' &&
    body.action !== 'reset-password' &&
    body.action !== 'status' &&
    body.action !== 'verify-ktm'
  ) {
    return errorResponse('Aksi tidak dikenal.', 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return errorResponse('Kunci server Supabase belum dikonfigurasi di .env.local.', 500);
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle<ProfileRow>();

  if (targetError) {
    return errorResponse(`Gagal membaca data akun: ${targetError.message}`, 500);
  }

  if (!target) {
    return errorResponse('Akun tidak ditemukan.', 404);
  }

  if (target.id === authData.user.id) {
    const selfMessages: Record<PatchBody['action'], string> = {
      role: 'Peran akun sendiri tidak dapat diubah dari panel ini.',
      'reset-password':
        'Gunakan halaman Pengaturan Akun untuk mengganti kata sandi Anda sendiri.',
      status: 'Akun sendiri tidak dapat dinonaktifkan dari panel ini.',
      'verify-ktm': 'Verifikasi KTM akun sendiri tidak dapat diubah dari panel ini.',
    };
    return errorResponse(selfMessages[body.action], 400);
  }

  if (body.action === 'role') {
    if (!isUserRole(body.role)) {
      return errorResponse('Peran yang dipilih tidak valid.', 400);
    }

    const nextRole = body.role;
    if (target.role === nextRole) {
      return errorResponse(`Akun ini sudah berperan ${ROLE_LABELS[nextRole]}.`, 400);
    }

    const isTargetActive = target.is_active !== false;
    if (
      target.role === 'SUPERADMIN' &&
      nextRole !== 'SUPERADMIN' &&
      isTargetActive &&
      !(await hasOtherActiveSuperadmin(admin, target.id))
    ) {
      return errorResponse(
        'Peran tidak dapat diubah: ini satu-satunya Superadmin aktif. Angkat Superadmin lain terlebih dahulu.',
        400
      );
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        role: nextRole,
        role_label: ROLE_LABELS[nextRole],
        updated_at: new Date().toISOString(),
      })
      .eq('id', target.id);

    if (updateError) {
      return errorResponse(`Peran gagal disimpan: ${updateError.message}`, 500);
    }

    const { error: metaError } = await admin.auth.admin.updateUserById(target.id, {
      user_metadata: { role: nextRole, role_label: ROLE_LABELS[nextRole] },
    });
    if (metaError) {
      console.error('updateUserMetadata error:', metaError.message);
    }

    return NextResponse.json({
      ok: true,
      message: `Peran ${target.name} diubah menjadi ${ROLE_LABELS[nextRole]}.`,
    });
  }

  if (body.action === 'reset-password') {
    const { error: passwordError } = await admin.auth.admin.updateUserById(target.id, {
      password: DEFAULT_ACCOUNT_PASSWORD,
    });

    if (passwordError) {
      return errorResponse(`Kata sandi gagal direset: ${passwordError.message}`, 500);
    }

    const { error: flagError } = await admin
      .from('profiles')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', target.id);

    if (flagError) {
      return errorResponse(
        `Kata sandi sudah direset, tetapi status wajib ganti gagal disimpan: ${flagError.message}`,
        500
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Kata sandi ${target.name} direset. Pengguna wajib menggantinya saat login.`,
      defaultPassword: DEFAULT_ACCOUNT_PASSWORD,
    });
  }

  if (body.action === 'verify-ktm') {
    const isApproved = Boolean(body.approved);
    const shouldClearDocument = !isApproved && Boolean(body.clearDocument);

    const metadataPatch: Record<string, unknown> = {
      ktm_verified: isApproved,
      ktm_rejected: shouldClearDocument,
    };
    if (shouldClearDocument) {
      metadataPatch.ktm_url = null;
      await clearUserKtmStorageFiles(admin, target.id);
    }

    const { error: verifyMetaErr } = await admin.auth.admin.updateUserById(target.id, {
      user_metadata: metadataPatch,
    });
    if (verifyMetaErr) {
      console.warn('Update user_metadata error:', verifyMetaErr.message);
    }

    const updatePayload: Record<string, unknown> = {
      ktm_verified: isApproved,
      updated_at: new Date().toISOString(),
    };
    if (isApproved) {
      updatePayload.profile_completed = true;
    }
    if (shouldClearDocument) {
      updatePayload.ktm_url = null;
    }

    let { error: verifyError } = await admin
      .from('profiles')
      .update(updatePayload)
      .eq('id', target.id);

    if (verifyError && verifyError.message.includes('ktm_')) {
      delete updatePayload.ktm_verified;
      delete updatePayload.ktm_url;
      const retry = await admin
        .from('profiles')
        .update(updatePayload)
        .eq('id', target.id);
      verifyError = retry.error;
    }

    if (verifyError) {
      return errorResponse(`Gagal memperbarui verifikasi KTM: ${verifyError.message}`, 500);
    }

    return NextResponse.json({
      ok: true,
      message: isApproved
        ? `KTM mahasiswa ${target.name} berhasil disetujui & diverifikasi.`
        : shouldClearDocument
          ? `Berkas KTM ${target.name} ditolak dan dikeluarkan dari antrean. Mahasiswa diminta mengunggah ulang.`
          : `Status verifikasi KTM ${target.name} dibatalkan dan dikembalikan ke antrean.`,
    });
  }

  if (typeof body.isActive !== 'boolean') {
    return errorResponse('Status akun tidak valid.', 400);
  }

  const nextActive = body.isActive;
  const currentlyActive = target.is_active !== false;

  if (currentlyActive === nextActive) {
    return errorResponse(
      nextActive ? 'Akun ini sudah aktif.' : 'Akun ini sudah nonaktif.',
      400
    );
  }

  if (
    !nextActive &&
    target.role === 'SUPERADMIN' &&
    currentlyActive &&
    !(await hasOtherActiveSuperadmin(admin, target.id))
  ) {
    return errorResponse(
      'Akun tidak dapat dinonaktifkan: ini satu-satunya Superadmin aktif.',
      400
    );
  }

  if (!nextActive) {
    const { error: banError } = await admin.auth.admin.updateUserById(target.id, {
      ban_duration: BAN_DURATION,
    });

    if (banError) {
      return errorResponse(`Akun gagal dinonaktifkan: ${banError.message}`, 500);
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', target.id);

    if (updateError) {
      await admin.auth.admin.updateUserById(target.id, { ban_duration: 'none' });
      return errorResponse(statusColumnError(updateError.message), 500);
    }

    return NextResponse.json({
      ok: true,
      message: `Akun ${target.name} dinonaktifkan dan tidak dapat login.`,
    });
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', target.id);

  if (updateError) {
    return errorResponse(statusColumnError(updateError.message), 500);
  }

  const { error: unbanError } = await admin.auth.admin.updateUserById(target.id, {
    ban_duration: 'none',
  });

  if (unbanError) {
    await admin
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', target.id);

    return errorResponse(`Akun gagal diaktifkan: ${unbanError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    message: `Akun ${target.name} diaktifkan kembali dan dapat login.`,
  });
}
