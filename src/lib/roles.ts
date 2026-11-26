import type { UserRole } from '@/types';

// Label peran dipakai bersama oleh panel admin dan API agar teks yang
// tersimpan di profiles selalu sama dengan yang tampil di antarmuka.
export const ROLE_LABELS: Record<UserRole, string> = {
  MAHASISWA: 'Mahasiswa',
  DOSEN: 'Dosen',
  SATPAM: 'Satpam',
  SUPERADMIN: 'Superadmin',
};

export const USER_ROLES: UserRole[] = ['MAHASISWA', 'DOSEN', 'SATPAM', 'SUPERADMIN'];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as string[]).includes(value);
}
