import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Claim,
  ClaimStatus,
  Complaint,
  ComplaintFormState,
  ComplaintStatus,
  FoundReportFormState,
  HandoverFormState,
  HandoverInfo,
  Item,
  ItemStatus,
  ItemType,
  RegisteredAccount,
  StorageType,
  UploadFormState,
  UserRole,
} from '@/types';

// ==========================================
// PEMETAAN BARIS DATABASE -> TIPE APLIKASI
// ==========================================

interface ItemRow {
  id: string;
  type: string;
  title: string;
  category: string;
  location: string;
  item_date: string;
  status: string;
  is_sensitive: boolean;
  storage_type: string;
  security_post: string;
  locker_code: string;
  description: string;
  secret_question: string;
  secret_answer_hint: string;
  reporter_name: string;
  reporter_id: string;
  reporter_phone: string;
  reporter_user_id: string;
  visual_theme: string;
  is_spam_reported: boolean;
  photo_url: string | null;
  handover_info: HandoverInfo | null;
  created_at: string;
  expires_at: string;
  archived_at: string | null;
}

interface ClaimRow {
  id: string;
  item_id: string;
  item_title: string;
  claimant_name: string;
  claimant_id: string;
  claimant_role: string;
  claimant_dept: string;
  claimant_user_id: string;
  secret_question: string;
  answer: string;
  additional_notes: string;
  has_proof_photo: boolean;
  proof_photo_name: string | null;
  status: string;
  ticket_code: string | null;
  storage_type: string;
  security_post: string;
  finder_phone: string;
  created_at: string;
}

interface ComplaintRow {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_identifier: string;
  category: string;
  description: string;
  incident_date: string;
  photo_path: string | null;
  status: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  role: string;
  role_label: string;
  name: string;
  identifier: string;
  id_type: string;
  department: string;
  phone: string;
  email_personal: string;
  avatar_url: string | null;
  must_change_password: boolean;
  profile_completed: boolean;
  // Kolom ini baru ada setelah migrasi admin_panel.sql dijalankan.
  is_active?: boolean | null;
  created_at: string;
  ktm_url?: string | null;
  ktm_verified?: boolean | null;
}

// Label waktu singkat untuk tampilan riwayat.
function formatTimeLabel(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return 'Baru saja';

  const minutes = Math.floor((Date.now() - created) / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;

  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function mapItemRow(row: ItemRow): Item {
  return {
    id: row.id,
    type: row.type as ItemType,
    title: row.title,
    category: row.category,
    location: row.location,
    date: row.item_date,
    status: row.status as ItemStatus,
    isSensitive: row.is_sensitive,
    storageType: row.storage_type as StorageType,
    securityPost: row.security_post,
    lockerCode: row.locker_code,
    description: row.description,
    secretQuestion: row.secret_question,
    secretAnswerHint: row.secret_answer_hint,
    reporterName: row.reporter_name,
    reporterId: row.reporter_id,
    reporterPhone: row.reporter_phone,
    reporterUserId: row.reporter_user_id,
    visualTheme: row.visual_theme,
    isSpamReported: row.is_spam_reported,
    photoUrl: row.photo_url,
    handoverInfo: row.handover_info ?? undefined,
    createdAtIso: row.created_at,
    expiresAt: row.expires_at,
    archivedAt: row.archived_at,
  };
}

function mapClaimRow(row: ClaimRow): Claim {
  return {
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.item_title,
    claimantName: row.claimant_name,
    claimantId: row.claimant_id,
    claimantRole: row.claimant_role,
    claimantDept: row.claimant_dept,
    claimantUserId: row.claimant_user_id,
    secretQuestion: row.secret_question,
    answer: row.answer,
    additionalNotes: row.additional_notes,
    hasProofPhoto: row.has_proof_photo,
    proofPhotoName: row.proof_photo_name,
    status: row.status as ClaimStatus,
    ticketCode: row.ticket_code,
    storageType: row.storage_type as StorageType,
    securityPost: row.security_post,
    finderPhone: row.finder_phone,
    createdAt: formatTimeLabel(row.created_at),
    createdAtIso: row.created_at,
  };
}

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatAccountDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function mapComplaintRow(row: ComplaintRow, photoUrl: string | null): Complaint {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name,
    reporterIdentifier: row.reporter_identifier,
    category: row.category,
    description: row.description,
    incidentDate: row.incident_date,
    incidentDateLabel: formatDateLabel(row.incident_date),
    photoPath: row.photo_path,
    photoUrl,
    status: row.status as ComplaintStatus,
    createdAtIso: row.created_at,
    createdAt: formatTimeLabel(row.created_at),
  };
}

// Barang dianggap terarsip bila sudah ditandai selesai atau masa tampilnya habis.
export function isItemArchived(item: Item): boolean {
  if (item.archivedAt) return true;
  return new Date(item.expiresAt).getTime() <= Date.now();
}

export function remainingDays(item: Item): number {
  const diff = new Date(item.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// ==========================================
// PENGAMBILAN DATA (RLS menentukan apa yang terlihat)
// ==========================================

function isMissingRelationError(message: string | undefined, relation: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes(relation.toLowerCase()) && (lower.includes('does not exist') || lower.includes('schema cache'));
}

async function fetchAvatarMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const avatarByUserId = new Map<string, string | null>();
  if (userIds.length === 0) return avatarByUserId;

  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, avatar_url')
    .in('id', userIds);

  let rows = data as { id: string; avatar_url: string | null }[] | null;
  if (error && isMissingRelationError(error.message, 'public_profiles')) {
    const fallback = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', userIds);
    rows = fallback.data as { id: string; avatar_url: string | null }[] | null;
  }

  for (const p of rows ?? []) {
    avatarByUserId.set(p.id, p.avatar_url ?? null);
  }
  return avatarByUserId;
}

export async function fetchItems(supabase: SupabaseClient): Promise<Item[]> {
  let { data, error } = await supabase
    .from('items_public')
    .select('*')
    .order('created_at', { ascending: false });

  if (error && isMissingRelationError(error.message, 'items_public')) {
    const fallback = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error('fetchItems error:', error.message);
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ItemRow[];
  const reporterIds = Array.from(
    new Set(rows.map((row) => row.reporter_user_id).filter(Boolean))
  );
  const avatarByUserId = await fetchAvatarMap(supabase, reporterIds);

  return rows.map((row) => ({
    ...mapItemRow(row),
    reporterAvatarUrl: avatarByUserId.get(row.reporter_user_id) ?? null,
  }));
}

export async function fetchClaims(supabase: SupabaseClient): Promise<Claim[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchClaims error:', error.message);
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ClaimRow[];
  const userIds = Array.from(
    new Set(rows.map((row) => row.claimant_user_id).filter(Boolean))
  );
  const avatarByUserId = await fetchAvatarMap(supabase, userIds);

  return rows.map((row) => ({
    ...mapClaimRow(row),
    claimantAvatarUrl: avatarByUserId.get(row.claimant_user_id) ?? null,
  }));
}

// Pengaduan dibaca sesuai RLS: pelapor hanya melihat miliknya, petugas
// melihat semua. Error dilempar agar UI bisa menampilkan status gagal muat
// yang jujur, bukan daftar kosong palsu.
export async function fetchComplaints(supabase: SupabaseClient): Promise<Complaint[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  const rows = data as ComplaintRow[];
  const paths = rows
    .map((row) => row.photo_path)
    .filter((path): path is string => Boolean(path));

  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: signedError } = await supabase.storage
      .from('complaint-photos')
      .createSignedUrls(paths, 60 * 60);

    if (!signedError && signed) {
      for (const item of signed) {
        if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
      }
    }
  }

  return rows.map((row) =>
    mapComplaintRow(row, row.photo_path ? signedByPath.get(row.photo_path) ?? null : null)
  );
}

// Data master lokasi & kategori dibaca publik. Nilai `null` dipakai untuk
// membedakan tabel yang belum tersedia dari daftar yang memang kosong.
export async function fetchLocations(supabase: SupabaseClient): Promise<string[] | null> {
  const { data, error } = await supabase.from('locations').select('name').order('name');

  if (error) {
    console.error('fetchLocations error:', error.message);
    return null;
  }

  return ((data ?? []) as { name: string }[]).map((row) => row.name);
}

export async function fetchCategories(supabase: SupabaseClient): Promise<string[] | null> {
  const { data, error } = await supabase.from('categories').select('name').order('name');

  if (error) {
    console.error('fetchCategories error:', error.message);
    return null;
  }

  return ((data ?? []) as { name: string }[]).map((row) => row.name);
}

// Daftar akun terdaftar untuk panel Superadmin. Diperkaya dengan pembacaan
// foto KTM dari storage dan user_metadata melalui API admin.
export async function fetchRegisteredAccounts(
  supabase: SupabaseClient
): Promise<RegisteredAccount[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/accounts');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.accounts)) {
          return json.accounts;
        }
      }
    } catch (e) {
      console.warn('Gagal memuat akun via API admin, fallback ke query langsung:', e);
    }
  }

  // Fallback query langsung jika dipanggil di server atau API gagal
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return (data as ProfileRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    identifier: row.identifier,
    role: row.role as UserRole,
    roleLabel: row.role_label,
    idType: row.id_type,
    department: row.department ?? '-',
    phone: row.phone ?? '-',
    emailPersonal: row.email_personal ?? '',
    avatarUrl: row.avatar_url ?? null,
    mustChangePassword: Boolean(row.must_change_password),
    profileCompleted: Boolean(row.profile_completed),
    isActive: row.is_active !== false,
    createdAt: formatAccountDate(row.created_at),
    ktmUrl: row.ktm_url ?? null,
    ktmVerified: Boolean(row.ktm_verified),
  }));
}

// ==========================================
// PENULISAN DATA
// ==========================================

export interface NewItemInput {
  form: UploadFormState;
  status: ItemStatus;
  isSensitive: boolean;
  visualTheme: string;
  lockerCode: string;
  reporter: {
    userId: string;
    name: string;
    roleLabel: string;
    identifier: string;
    phone: string;
  };
}

// Simpan laporan baru. Masa tampil publik 7 hari diatur oleh default kolom expires_at.
export async function insertItem(
  supabase: SupabaseClient,
  input: NewItemInput
): Promise<string | null> {
  const { form, reporter } = input;
  const isFound = form.type === 'FOUND';

  // Unggah foto barang asli (opsional) ke Supabase Storage bucket "item-photos".
  let uploadedPhotoPath: string | null = null;
  let photoUrl: string | undefined;
  if (form.photoFile) {
    const extension = form.photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const photoPath = `items/${reporter.userId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('item-photos')
      .upload(photoPath, form.photoFile, { upsert: true, cacheControl: '3600' });

    if (uploadError) {
      console.error('uploadItemPhoto error:', uploadError.message);
      return null;
    }
    uploadedPhotoPath = photoPath;
    photoUrl = supabase.storage.from('item-photos').getPublicUrl(photoPath).data.publicUrl;
  }

  const { data, error } = await supabase
    .from('items')
    .insert({
      type: form.type,
      title: form.title,
      category: form.category,
      location: form.location,
      item_date: form.datetime,
      status: input.status,
      is_sensitive: input.isSensitive,
      storage_type: isFound ? form.storageType : 'NONE',
      security_post: isFound && form.storageType === 'SATPAM' ? form.securityPost : '-',
      locker_code: input.lockerCode,
      description: form.description || 'Tidak ada deskripsi tambahan.',
      secret_question: isFound ? form.secretQuestion : '',
      secret_answer_hint: isFound ? form.secretAnswerHint || 'Sesuai ciri fisik barang' : '',
      reporter_name: `${reporter.name} (${reporter.roleLabel})`,
      reporter_id: reporter.identifier,
      reporter_phone: reporter.phone,
      reporter_user_id: reporter.userId,
      visual_theme: input.visualTheme,
      photo_url: photoUrl ?? null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    if (error) console.error('insertItem error:', error.message, error.details);
    if (uploadedPhotoPath) {
      await supabase.storage.from('item-photos').remove([uploadedPhotoPath]).catch(() => undefined);
    }
    return null;
  }
  return (data as { id: string }).id;
}

export interface NewClaimInput {
  item: Item;
  answer: string;
  additionalNotes: string;
  proofPhotoFile: File | null;
  claimant: {
    userId: string;
    name: string;
    identifier: string;
    roleLabel: string;
    department: string;
  };
}

export async function insertClaim(
  supabase: SupabaseClient,
  input: NewClaimInput
): Promise<{ ok: boolean; error?: string }> {
  const { item, claimant } = input;
  let uploadedPhotoPath: string | null = null;
  let proofPhotoUrl: string | null = null;

  if (input.proofPhotoFile) {
    const extension = input.proofPhotoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const photoPath = `items/${claimant.userId}/claim-proof-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('item-photos')
      .upload(photoPath, input.proofPhotoFile, { upsert: true, cacheControl: '3600' });

    if (uploadError) {
      console.error('uploadClaimProof error:', uploadError.message);
      return { ok: false, error: uploadError.message };
    }
    uploadedPhotoPath = photoPath;
    proofPhotoUrl = supabase.storage.from('item-photos').getPublicUrl(photoPath).data.publicUrl;
  }

  const { error } = await supabase.from('claims').insert({
    item_id: item.id,
    item_title: item.title,
    claimant_name: claimant.name,
    claimant_id: claimant.identifier,
    claimant_role: claimant.roleLabel,
    claimant_dept: claimant.department,
    claimant_user_id: claimant.userId,
    secret_question: item.secretQuestion,
    answer: input.answer,
    additional_notes: input.additionalNotes || 'Tidak ada catatan tambahan.',
    has_proof_photo: Boolean(proofPhotoUrl),
    proof_photo_name: proofPhotoUrl,
    status: 'PENDING',
    storage_type: item.storageType,
    security_post: item.securityPost,
    finder_phone: item.reporterPhone,
  });

  if (error) {
    console.error('insertClaim error:', error.message);
    if (uploadedPhotoPath) {
      await supabase.storage.from('item-photos').remove([uploadedPhotoPath]).catch(() => undefined);
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export interface NewFoundReportInput {
  item: Item;
  form: FoundReportFormState;
  finder: {
    userId: string;
    name: string;
    identifier: string;
    roleLabel: string;
    department: string;
    phone: string;
  };
}

// Kirim laporan penemuan untuk barang hilang (LOST) dengan bukti foto wajib.
// Memakai tabel `claims` dan bucket `item-photos` sesuai policy RLS yang sudah ada.
export async function insertFoundReport(
  supabase: SupabaseClient,
  input: NewFoundReportInput
): Promise<{ ok: boolean; error?: string }> {
  const { item, form, finder } = input;

  if (!form.proofPhotoFile) {
    return { ok: false, error: 'Foto bukti barang temuan wajib diunggah.' };
  }

  const extension = form.proofPhotoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const photoPath = `items/${finder.userId}/found-proof-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('item-photos')
    .upload(photoPath, form.proofPhotoFile, { upsert: true, cacheControl: '3600' });

  if (uploadError) {
    console.error('uploadFoundProof error:', uploadError.message);
    return { ok: false, error: uploadError.message };
  }

  const proofPhotoUrl = supabase.storage
    .from('item-photos')
    .getPublicUrl(photoPath).data.publicUrl;

  const { error } = await supabase.from('claims').insert({
    item_id: item.id,
    item_title: item.title,
    claimant_name: finder.name,
    claimant_id: finder.identifier,
    claimant_role: finder.roleLabel,
    claimant_dept: finder.department,
    claimant_user_id: finder.userId,
    secret_question: 'Laporan Penemuan Barang Hilang',
    answer: form.foundLocation.trim(),
    additional_notes: form.notes.trim() || 'Tidak ada catatan tambahan.',
    has_proof_photo: true,
    proof_photo_name: proofPhotoUrl,
    status: 'PENDING',
    storage_type: form.handoverMethod,
    security_post: form.handoverMethod === 'SATPAM' ? form.securityPost : '-',
    finder_phone: finder.phone,
  });

  if (error) {
    console.error('insertFoundReport error:', error.message);
    await supabase.storage.from('item-photos').remove([photoPath]).catch(() => undefined);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function updateClaimDecision(
  supabase: SupabaseClient,
  claimId: string,
  decision: ClaimStatus,
  ticketCode: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('claims')
    .update({ status: decision, ticket_code: ticketCode })
    .eq('id', claimId);

  return !error;
}

export async function updateItemStatus(
  supabase: SupabaseClient,
  itemId: string,
  patch: { status?: ItemStatus; lockerCode?: string; handoverInfo?: HandoverInfo }
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (patch.status) payload.status = patch.status;
  if (patch.lockerCode) payload.locker_code = patch.lockerCode;
  if (patch.handoverInfo) payload.handover_info = patch.handoverInfo;

  const { error } = await supabase.from('items').update(payload).eq('id', itemId);
  return !error;
}

// Sensor publik hanya mengubah satu kolom. RLS `items_update` sudah membatasi
// perubahan ini untuk Satpam dan Superadmin.
export async function updateItemSensitivity(
  supabase: SupabaseClient,
  itemId: string,
  isSensitive: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('items')
    .update({ is_sensitive: isSensitive })
    .eq('id', itemId);

  if (error) console.error('updateItemSensitivity error:', error.message);
  return !error;
}

// Kolom yang boleh diubah pemilik saat menyunting laporannya.
export interface UpdateItemPatch {
  title?: string;
  category?: string;
  location?: string;
  itemDate?: string;
  description?: string;
  isSensitive?: boolean;
  storageType?: StorageType;
  securityPost?: string;
  status?: ItemStatus;
  secretQuestion?: string;
  secretAnswerHint?: string;
  visualTheme?: string;
  photoFile?: File | null;
}

// Sunting laporan. Jika ada foto baru, unggah ke folder user aktif (pemilik atau staf) lalu ganti photo_url.
export async function updateItem(
  supabase: SupabaseClient,
  itemId: string,
  uploaderUserId: string,
  patch: UpdateItemPatch
): Promise<boolean> {
  const payload: Record<string, unknown> = {};

  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.location !== undefined) payload.location = patch.location;
  if (patch.itemDate !== undefined) payload.item_date = patch.itemDate;
  if (patch.description !== undefined) payload.description = patch.description || 'Tidak ada deskripsi tambahan.';
  if (patch.isSensitive !== undefined) payload.is_sensitive = patch.isSensitive;
  if (patch.storageType !== undefined) payload.storage_type = patch.storageType;
  if (patch.securityPost !== undefined) payload.security_post = patch.securityPost || '-';
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.secretQuestion !== undefined) payload.secret_question = patch.secretQuestion;
  if (patch.secretAnswerHint !== undefined) payload.secret_answer_hint = patch.secretAnswerHint;
  if (patch.visualTheme !== undefined) payload.visual_theme = patch.visualTheme;

  let uploadedPhotoPath: string | null = null;
  if (patch.photoFile) {
    const extension = patch.photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const photoPath = `items/${uploaderUserId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('item-photos')
      .upload(photoPath, patch.photoFile, { upsert: true, cacheControl: '3600' });

    if (uploadError) {
      console.error('updateItemPhoto error:', uploadError.message);
      return false;
    }
    uploadedPhotoPath = photoPath;
    payload.photo_url = supabase.storage.from('item-photos').getPublicUrl(photoPath).data.publicUrl;
  }

  if (Object.keys(payload).length === 0) return true;

  const { error } = await supabase.from('items').update(payload).eq('id', itemId);
  if (error) {
    console.error('updateItem error:', error.message, error.details);
    if (uploadedPhotoPath) {
      await supabase.storage.from('item-photos').remove([uploadedPhotoPath]).catch(() => undefined);
    }
  }
  return !error;
}

// Hapus laporan milik sendiri. Klaim & chat terkait ikut terhapus via ON DELETE CASCADE.
export async function deleteItem(
  supabase: SupabaseClient,
  itemId: string,
  photoUrl?: string | null
): Promise<boolean> {
  const { error } = await supabase.from('items').delete().eq('id', itemId);
  if (error) {
    console.error('deleteItem error:', error.message);
    return false;
  }

  if (photoUrl) {
    const marker = '/storage/v1/object/public/item-photos/';
    const idx = photoUrl.indexOf(marker);
    if (idx !== -1) {
      const storagePath = decodeURIComponent(photoUrl.slice(idx + marker.length).split('?')[0]);
      if (storagePath.startsWith('items/') && !storagePath.includes('..')) {
        await supabase.storage.from('item-photos').remove([storagePath]).catch(() => undefined);
      }
    }
  }
  return true;
}

export async function insertLocation(
  supabase: SupabaseClient,
  name: string
): Promise<boolean> {
  const { error } = await supabase.from('locations').insert({ name: name.trim() });
  if (error) console.error('insertLocation error:', error.message);
  return !error;
}

export async function deleteLocation(
  supabase: SupabaseClient,
  name: string
): Promise<boolean> {
  const { error } = await supabase.from('locations').delete().eq('name', name);
  if (error) console.error('deleteLocation error:', error.message);
  return !error;
}

export async function insertCategory(
  supabase: SupabaseClient,
  name: string
): Promise<boolean> {
  const { error } = await supabase.from('categories').insert({ name: name.trim() });
  if (error) console.error('insertCategory error:', error.message);
  return !error;
}

export async function deleteCategory(
  supabase: SupabaseClient,
  name: string
): Promise<boolean> {
  const { error } = await supabase.from('categories').delete().eq('name', name);
  if (error) console.error('deleteCategory error:', error.message);
  return !error;
}

export interface NewComplaintInput {
  form: ComplaintFormState;
  reporter: {
    userId: string;
    name: string;
    identifier: string;
  };
}

// Simpan pengaduan baru. Foto bukti diunggah lebih dulu ke bucket privat
// dengan folder per pengguna, lalu path-nya yang disimpan di database.
export async function insertComplaint(
  supabase: SupabaseClient,
  input: NewComplaintInput
): Promise<boolean> {
  const { form, reporter } = input;
  let photoPath: string | null = null;

  if (form.photoFile) {
    const extension = form.photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${reporter.userId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('complaint-photos')
      .upload(path, form.photoFile, { upsert: false, cacheControl: '3600' });

    if (uploadError) {
      console.error('uploadComplaintPhoto error:', uploadError.message);
      return false;
    }
    photoPath = path;
  }

  const { error } = await supabase.from('complaints').insert({
    reporter_id: reporter.userId,
    reporter_name: reporter.name,
    reporter_identifier: reporter.identifier,
    category: form.category,
    description: form.description.trim(),
    incident_date: form.incidentDate,
    photo_path: photoPath,
    status: 'Menunggu',
  });

  if (error) {
    console.error('insertComplaint error:', error.message);
    // Jangan tinggalkan file yatim bila baris database gagal dibuat.
    if (photoPath) {
      await supabase.storage.from('complaint-photos').remove([photoPath]);
    }
    return false;
  }

  return true;
}

export async function updateComplaintStatus(
  supabase: SupabaseClient,
  complaintId: string,
  status: ComplaintStatus
): Promise<boolean> {
  const { error } = await supabase
    .from('complaints')
    .update({ status })
    .eq('id', complaintId);

  return !error;
}

// Dipakai form serah terima Satpam: menyusun keterangan penyerahan.
// photoUrl diisi setelah foto dokumentasi berhasil diunggah ke Supabase Storage.
export function buildHandoverInfo(
  claim: Claim,
  form: HandoverFormState,
  verifiedBy: string,
  photoUrl?: string,
  claimedByOverride?: string
): HandoverInfo {
  return {
    claimedBy: claimedByOverride || `${claim.claimantName} (${claim.claimantId})`,
    ticketCode: form.ticketCode.trim(),
    handoverTime: new Date().toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    verifiedBy,
    ...(photoUrl ? { photoUrl } : {}),
  };
}
