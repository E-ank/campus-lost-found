// ==========================================
// TIPE GLOBAL PLATFORM CAMPUS LOST & FOUND
// ==========================================

export type UserRole = 'MAHASISWA' | 'DOSEN' | 'SATPAM' | 'SUPERADMIN';

export type ItemType = 'FOUND' | 'LOST';

export type ItemStatus =
  | 'Dicari'
  | 'Menunggu Diserahkan ke Pos'
  | 'Di Pos Satpam'
  | 'Di Penemu'
  | 'Selesai';

export type StorageType = 'SATPAM' | 'FINDER' | 'NONE';

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SELESAI';

export type ToastType = 'success' | 'error' | 'info';

export interface UserProfile {
  id: string;
  role: UserRole;
  roleLabel: string;
  name: string;
  identifier: string;
  idType: string;
  department: string;
  phone: string;
  avatarBg: string;
  avatarUrl: string | null;
  emailPersonal: string;
  mustChangePassword: boolean;
  profileCompleted: boolean;
  isActive: boolean;
  ktmUrl?: string | null;
  ktmVerified?: boolean;
  ktmRejected?: boolean;
}

export interface HandoverInfo {
  claimedBy: string;
  ticketCode: string;
  handoverTime: string;
  verifiedBy: string;
  photoUrl?: string;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  category: string;
  location: string;
  date: string;
  status: ItemStatus;
  isSensitive: boolean;
  storageType: StorageType;
  securityPost: string;
  lockerCode: string;
  description: string;
  secretQuestion: string;
  secretAnswerHint: string;
  reporterName: string;
  reporterId: string;
  reporterPhone: string;
  reporterUserId: string;
  reporterAvatarUrl?: string | null;
  visualTheme: string;
  isSpamReported: boolean;
  photoUrl?: string | null;
  handoverInfo?: HandoverInfo;
  createdAtIso: string;
  expiresAt: string;
  archivedAt: string | null;
}

export interface Claim {
  id: string;
  itemId: string;
  itemTitle: string;
  claimantName: string;
  claimantId: string;
  claimantRole: string;
  claimantDept: string;
  claimantUserId: string;
  claimantAvatarUrl?: string | null;
  secretQuestion: string;
  answer: string;
  additionalNotes: string;
  hasProofPhoto: boolean;
  proofPhotoName: string | null;
  status: ClaimStatus;
  ticketCode: string | null;
  storageType: StorageType;
  securityPost: string;
  finderPhone: string;
  createdAt: string;
  createdAtIso: string;
}

export interface RegisteredAccount {
  id: string;
  name: string;
  identifier: string;
  role: UserRole;
  roleLabel: string;
  idType: string;
  department: string;
  phone: string;
  emailPersonal: string;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  profileCompleted: boolean;
  isActive: boolean;
  createdAt: string;
  ktmUrl?: string | null;
  ktmVerified?: boolean;
}

export interface ToastMessage {
  title: string;
  message: string;
  type: ToastType;
}

export type ComplaintStatus = 'Menunggu' | 'Diproses' | 'Selesai' | 'Ditolak';

export interface Complaint {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterIdentifier: string;
  category: string;
  description: string;
  incidentDate: string;
  incidentDateLabel: string;
  photoPath: string | null;
  photoUrl: string | null;
  status: ComplaintStatus;
  createdAtIso: string;
  createdAt: string;
}

export interface ComplaintFormState {
  category: string;
  incidentDate: string;
  description: string;
  photoFile: File | null;
}

export interface LoginGateState {
  isOpen: boolean;
  message: string;
}

export interface RedirectIntent {
  path: string;
  itemId: string | null;
  openClaim: boolean;
}

export interface UploadFormState {
  type: ItemType;
  title: string;
  category: string;
  location: string;
  datetime: string;
  description: string;
  storageType: Exclude<StorageType, 'NONE'>;
  securityPost: string;
  secretQuestion: string;
  secretAnswerHint: string;
  isSensitive: boolean;
  photoFile: File | null;
}

export interface ClaimFormState {
  answer: string;
  additionalNotes: string;
  proofPhotoFile: File | null;
}

export interface FoundReportFormState {
  foundLocation: string;
  notes: string;
  handoverMethod: 'SATPAM' | 'FINDER';
  securityPost: string;
  proofPhotoFile: File | null;
}

export interface ProfileSetupFormState {
  name: string;
  identifier: string;
  password: string;
  confirmPassword: string;
  emailPersonal: string;
  phone: string;
  department: string;
  ktmUrl?: string;
  ktmVerified?: boolean;
}

export interface BulkAccountRow {
  identifier: string;
  name: string;
  department: string;
}

export interface HandoverFormState {
  ticketCode: string;
  ktmVerified: boolean;
  photoFile: File | null;
}
