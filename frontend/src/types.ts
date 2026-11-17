export type MMUId =
  | 'MMU-003'
  | 'MMU-106'
  | 'MMU-004'
  | 'MMU-110'
  | 'MMU-091'
  | 'MMU-107'
  | 'MMU-108'
  | 'MMU-100'
  | 'MMU-101';

export const MMU_LIST: readonly MMUId[] = [
  'MMU-003',
  'MMU-106',
  'MMU-004',
  'MMU-110',
  'MMU-091',
  'MMU-107',
  'MMU-108',
  'MMU-100',
  'MMU-101',
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
