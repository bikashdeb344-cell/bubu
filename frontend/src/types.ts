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

export const MMU_LIST: readonly MMUId[] = [
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

export type SessionType = 'AM' | 'PM';

export interface DriveStatusResponse {
  status: 'connected' | 'repairing' | 'verified' | 'failed' | 'not_configured';
  authenticated: boolean;
  rootFolderFound: boolean;
  rootFolderId?: string;
  totalExpected: number;
  totalVerified: number;
  repairedCount: number;
  repairedPaths: string[];
  message: string;
}

export interface SelectedFile {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  type: string;
  error?: string;
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

export interface HistoryItem {
  id: string;
  timestamp: string;
  mmu: string;
  session: string;
  filename: string;
  status: 'success' | 'failed';
  drivePath?: string;
  error?: string;
}
