// Konversi NIM/NIDN/ID Petugas menjadi email sintetis untuk Supabase Auth.
// Supabase Auth berbasis email, sehingga identitas kampus dipetakan ke domain internal.
const INTERNAL_DOMAIN = 'kampus.local';

export function toSyntheticEmail(identifier: string): string {
  return `${identifier.trim().toLowerCase()}@${INTERNAL_DOMAIN}`;
}

export function toIdentifier(email: string | null | undefined): string {
  if (!email) return '-';
  return email.split('@')[0].toUpperCase();
}
