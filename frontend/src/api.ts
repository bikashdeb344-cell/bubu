import { DriveStatusResponse, MMUId, SessionType, UploadResponse } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchDriveStatus(): Promise<DriveStatusResponse> {
  const res = await fetch(`${API_BASE}/api/drive/status`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch Google Drive status (${res.status})`);
  }
  return res.json();
}

export async function initializeDriveStructure(): Promise<DriveStatusResponse> {
  const res = await fetch(`${API_BASE}/api/drive/initialize`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to initialize Google Drive structure (${res.status})`);
  }
  return res.json();
}

export async function uploadPhotographs(
  mmu: MMUId,
  session: SessionType,
  files: File[]
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('mmu', mmu);
  formData.append('session', session);

  for (const file of files) {
    formData.append('photos', file, file.name);
  }

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  // 200 (all success), 207 (partial success), or errors
  if (!res.ok && res.status !== 207) {
    throw new Error(data.error || `Upload failed with HTTP ${res.status}`);
  }

  return data as UploadResponse;
}
