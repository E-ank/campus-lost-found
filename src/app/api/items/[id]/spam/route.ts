import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// POST: tandai laporan sebagai spam/tidak pantas oleh pengguna yang sudah login.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return errorResponse('ID laporan tidak valid.', 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse('Tidak terautentikasi.', 401);
  }

  const { data: requester } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (requester?.is_active === false) {
    return errorResponse('Akun dinonaktifkan.', 403);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return errorResponse('Kunci server Supabase belum dikonfigurasi.', 500);
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: item } = await admin
    .from('items')
    .select('id, reporter_user_id')
    .eq('id', id)
    .maybeSingle();

  if (!item) {
    return errorResponse('Laporan tidak ditemukan.', 404);
  }

  if (item.reporter_user_id === user.id) {
    return errorResponse('Anda tidak perlu melaporkan postingan sendiri.', 400);
  }

  const { error } = await admin
    .from('items')
    .update({ is_spam_reported: true })
    .eq('id', id);

  if (error) {
    return errorResponse(`Gagal melaporkan spam: ${error.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    message: 'Laporan spam diteruskan ke Admin untuk ditinjau.',
  });
}

// DELETE: abaikan / bersihkan tanda spam pada laporan (khusus Satpam / Superadmin).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return errorResponse('ID laporan tidak valid.', 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse('Tidak terautentikasi.', 401);
  }

  const { data: requester } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (
    (requester?.role !== 'SUPERADMIN' && requester?.role !== 'SATPAM') ||
    requester?.is_active === false
  ) {
    return errorResponse('Akses ditolak: khusus petugas berwenang.', 403);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return errorResponse('Kunci server Supabase belum dikonfigurasi.', 500);
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin
    .from('items')
    .update({ is_spam_reported: false })
    .eq('id', id);

  if (error) {
    return errorResponse(`Gagal mengabaikan laporan spam: ${error.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    message: 'Tanda spam dihapus; laporan tetap dipertahankan.',
  });
}
