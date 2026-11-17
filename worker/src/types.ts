export interface Env {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  GOOGLE_DRIVE_ROOT_FOLDER_ID?: string;
  ALLOWED_ORIGIN?: string;
  MAX_FILE_SIZE_MB?: string;
  MAX_FILES_PER_UPLOAD?: string;
}

export type MMUId =
  | 'MMU-001'
  | 'MMU-002'
  | 'MMU-003'
  | 'MMU-004'
  | 'MMU-005'
  | 'MMU-006'
  | 'MMU-007'
  | 'MMU-008'
  | 'MMU-009';

export type SessionType = 'AM' | 'PM';

export const VALID_MMUS: readonly MMUId[] = [
  'MMU-001',
  'MMU-002',
  'MMU-003',
  'MMU-004',
  'MMU-005',
  'MMU-006',
  'MMU-007',
  'MMU-008',
  'MMU-009',
] as const;

export const VALID_SESSIONS: readonly SessionType[] = ['AM', 'PM'] as const;

export interface DirectoryDetail {
  id?: string;
  verified: boolean;
}

export interface MMUDirectoryMap {
  [mmu: string]: {
    id?: string;
    verified: boolean;
    AM?: DirectoryDetail;
    PM?: DirectoryDetail;
  };
}

export interface DriveStatusResponse {
  status: 'connected' | 'repairing' | 'verified' | 'failed' | 'not_configured';
  authenticated: boolean;
  rootFolderFound: boolean;
  rootFolderId?: string;
  totalExpected: number;
  totalVerified: number;
  repairedCount: number;
  repairedPaths: string[];
  mmuStructure: MMUDirectoryMap;
  message: string;
}

export interface UploadFileResult {
  filename: string;
  success: boolean;
  fileId?: string;
  drivePath?: string;
  error?: string;
  size?: number;
  mimeType?: string;
}

export interface UploadResponse {
  mmu: MMUId;
  session: SessionType;
  destination: string;
  total: number;
  successful: number;
  failed: number;
  results: UploadFileResult[];
}
