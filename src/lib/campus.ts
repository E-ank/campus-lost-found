// Daftar Pos Satpam kampus yang dipakai bersama oleh form lapor dan form temuan.
export const SECURITY_POST_OPTIONS = [
  'Pos Utama Gerbang Depan',
  'Pos Satpam Gedung A',
  'Pos Perpustakaan',
  'Pos Satpam Parkiran Belakang',
] as const;

// Daftar peran yang wajib melengkapi verifikasi identitas KTM/SIAKAD.
export function requiresStudentIdentityVerification(role: string | undefined): boolean {
  return role === 'MAHASISWA';
}
