// Batas keamanan unggahan foto di seluruh aplikasi:
// hanya format gambar web-standar dengan ukuran wajar agar bucket Storage
// tidak bisa diisi file sembarangan (HTML/SVG berbahaya atau file raksasa).
export const PHOTO_MAX_MB = 2;
export const PHOTO_MAX_BYTES = PHOTO_MAX_MB * 1024 * 1024;

// Format yang diizinkan. HEIC khas iPhone memang tidak masuk daftar
// karena tidak bisa ditampilkan langsung oleh browser lain saat dibagikan.
export const PHOTO_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** Kembalikan pesan error bila file ditolak, atau null bila lolos validasi. */
export function validatePhotoFile(file: File): string | null {
  if (!PHOTO_ACCEPTED.includes(file.type)) {
    return 'Format foto harus JPG, PNG, atau WebP. Foto iPhone (HEIC) silakan ubah dulu ke format tersebut.';
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return `Ukuran foto maksimal ${PHOTO_MAX_MB} MB (foto ini ${Math.ceil(file.size / (1024 * 1024))} MB).`;
  }
  return null;
}
