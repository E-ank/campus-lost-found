// Kunci publik VAPID untuk Web Push Protocol (aman dipakai di browser).
// Kunci privat disimpan terpisah di server (src/lib/push-server.ts).
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BPFC-kgHWHNEUVv-2Cn1bbSJmue2uUJu1LDKbOB40JUd2UT4-usLLsLWy3_e5HCiLhXUn2uB7O-yU3URSv3VRqo';

/**
 * Konversi kunci VAPID Base64 ke Uint8Array untuk PushManager.subscribe
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
