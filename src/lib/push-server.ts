// Konfigurasi VAPID khusus server; tidak boleh diimpor dari komponen klien.
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BPFC-kgHWHNEUVv-2Cn1bbSJmue2uUJu1LDKbOB40JUd2UT4-usLLsLWy3_e5HCiLhXUn2uB7O-yU3URSv3VRqo';

export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@lost-found.my.id';
