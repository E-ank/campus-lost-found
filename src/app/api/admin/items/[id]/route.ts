import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ItemRow {
  id: string;
  title: string;
  reporter_user_id: string;
  photo_url: string | null;
  handover_info: { photoUrl?: string } | null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Ambil path objek hanya jika berasal dari origin Supabase proyek ini dan cocok dengan prefix sah.
function storagePathFromPublicUrl(
  targetUrl: string | null | undefined,
  bucket: string,
  expectedOrigin: string,
  allowedPrefixes: string[]
): string | null {
  if (!targetUrl) return null;
  try {
    const parsed = new URL(targetUrl);
    const base = new URL(expectedOrigin);
    if (parsed.origin !== base.origin) return null;

    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;

    const rawPath = parsed.pathname.slice(index + marker.length);
    const decoded = decodeURIComponent(rawPath);
    if (decoded.includes('..')) return null;
    if (!allowedPrefixes.some((prefix) => decoded.startsWith(prefix))) return null;
    return decoded;
  } catch {
    return null;
  }
}

// Hapus laporan barang beserta klaim terkait dan berkas storage miliknya.
// Hanya Superadmin aktif yang boleh memanggil endpoint ini.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return errorResponse('ID laporan tidak valid.', 400);
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return errorResponse('Tidak terautentikasi.', 401);
  }

  const { data: requester } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .single();

  if (requester?.role !== 'SUPERADMIN' || requester?.is_active === false) {
    return errorResponse('Akses ditolak: khusus Superadmin aktif.', 403);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return errorResponse('Kunci server Supabase belum dikonfigurasi di .env.local.', 500);
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: item, error: itemError } = await admin
    .from('items')
    .select('id, title, reporter_user_id, photo_url, handover_info')
    .eq('id', id)
    .maybeSingle<ItemRow>();

  if (itemError) {
    return errorResponse(`Gagal membaca laporan: ${itemError.message}`, 500);
  }

  if (!item) {
    return errorResponse('Laporan tidak ditemukan.', 404);
  }

  const { data: claimRows } = await admin
    .from('claims')
    .select('id, claimant_user_id, proof_photo_name')
    .eq('item_id', id);

  const claimCount = claimRows?.length ?? 0;

  const { error: deleteError } = await admin.from('items').delete().eq('id', id);

  if (deleteError) {
    return errorResponse(`Laporan gagal dihapus: ${deleteError.message}`, 500);
  }

  const itemPhotoPathsToRemove: string[] = [];
  const mainPhotoPath = storagePathFromPublicUrl(item.photo_url, 'item-photos', url, [
    `items/${item.reporter_user_id}/`,
  ]);
  if (mainPhotoPath) {
    itemPhotoPathsToRemove.push(mainPhotoPath);
  }

  for (const claim of claimRows ?? []) {
    const claimPhotoPath = storagePathFromPublicUrl(
      claim.proof_photo_name as string | null | undefined,
      'item-photos',
      url,
      [`items/${claim.claimant_user_id}/`]
    );
    if (claimPhotoPath) {
      itemPhotoPathsToRemove.push(claimPhotoPath);
    }
  }

  if (itemPhotoPathsToRemove.length > 0) {
    const { error: photoError } = await admin.storage
      .from('item-photos')
      .remove(itemPhotoPathsToRemove);
    if (photoError) {
      console.error('deleteItemPhotos error:', photoError.message);
    }
  }

  const handoverPhotoPath = storagePathFromPublicUrl(
    item.handover_info?.photoUrl,
    'handover',
    url,
    [`finder/${item.id}/`, `satpam/${item.id}/`]
  );
  if (handoverPhotoPath) {
    const { error: handoverError } = await admin.storage
      .from('handover')
      .remove([handoverPhotoPath]);
    if (handoverError) {
      console.error('deleteHandoverPhoto error:', handoverError.message);
    }
  }

  const claimNote =
    claimCount > 0
      ? ` beserta ${claimCount} klaim terkait`
      : '';

  return NextResponse.json({
    ok: true,
    message: `Laporan "${item.title}" dihapus${claimNote}.`,
  });
}
