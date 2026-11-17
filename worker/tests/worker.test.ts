import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import { Env } from '../src/types';

// Mock environment
const mockEnv: Env = {
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REFRESH_TOKEN: 'test-refresh-token',
  GOOGLE_DRIVE_ROOT_FOLDER_ID: 'root-storage-id',
  ALLOWED_ORIGIN: '*',
  MAX_FILE_SIZE_MB: '15',
  MAX_FILES_PER_UPLOAD: '20',
};

// Helper to generate minimal valid image bytes
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00]);
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

describe('Cloudflare Worker API & Google Drive Integration Tests', () => {
  let createdDriveFolders: Map<string, string>;
  let uploadedDriveFiles: Map<string, { name: string; parentId: string; mimeType: string }>;

  beforeEach(() => {
    vi.restoreAllMocks();
    createdDriveFolders = new Map<string, string>();
    uploadedDriveFiles = new Map<string, { name: string; parentId: string; mimeType: string }>();

    // Mock global fetch for Google Drive APIs
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();

      // 1. Google OAuth Token Refresh
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'mock-access-token-12345',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 2. Google Drive Root Folder Lookup
      if (urlStr.includes('googleapis.com/drive/v3/files/root-storage-id')) {
        return new Response(
          JSON.stringify({
            id: 'root-storage-id',
            name: 'MMU-PHOTO-STORAGE',
            mimeType: 'application/vnd.google-apps.folder',
            trashed: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 3. Google Drive List Child Folders
      if (urlStr.includes('googleapis.com/drive/v3/files?q=')) {
        const query = decodeURIComponent(urlStr);
        const files: Array<{ id: string; name: string }> = [];

        // Check which parent is being queried
        for (const [key, folderId] of createdDriveFolders.entries()) {
          const [parent, name] = key.split(':');
          if (query.includes(`'${parent}' in parents`)) {
            files.push({ id: folderId, name });
          }
        }

        return new Response(JSON.stringify({ files }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 4. Google Drive Create Folder
      if (urlStr.includes('googleapis.com/drive/v3/files') && init?.method === 'POST' && !urlStr.includes('upload')) {
        const body = JSON.parse(init.body as string);
        const folderId = `folder-id-${body.name}-${Date.now()}`;
        createdDriveFolders.set(`${body.parents[0]}:${body.name}`, folderId);

        return new Response(JSON.stringify({ id: folderId, name: body.name }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 5. Google Drive Resumable Upload Initiate
      if (urlStr.includes('upload/drive/v3/files?uploadType=resumable')) {
        const body = JSON.parse(init?.body as string || '{}');
        const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        uploadedDriveFiles.set(fileId, {
          name: body.name || 'uploaded-file',
          parentId: body.parents?.[0] || 'mock-parent',
          mimeType: (init?.headers as Record<string, string>)?.['X-Upload-Content-Type'] || 'image/jpeg',
        });

        return new Response(null, {
          status: 200,
          headers: {
            Location: `https://www.googleapis.com/upload/drive/v3/files/resumable-session-${fileId}`,
          },
        });
      }

      // 6. Resumable Upload PUT bytes
      if (urlStr.includes('upload/drive/v3/files/resumable-session-')) {
        const fileId = urlStr.split('resumable-session-')[1];
        const fileMeta = uploadedDriveFiles.get(fileId) || {
          name: 'uploaded-file',
          parentId: 'mock-parent',
          mimeType: 'image/jpeg',
        };

        return new Response(
          JSON.stringify({
            id: fileId,
            name: fileMeta.name,
            mimeType: fileMeta.mimeType,
            size: '1024',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 7. Post-upload verification file lookup
      if (urlStr.match(/googleapis\.com\/drive\/v3\/files\/file-[^?]+/)) {
        const match = urlStr.match(/files\/(file-[^?]+)/);
        const fileId = match ? match[1] : 'unknown';
        const fileMeta = uploadedDriveFiles.get(fileId) || {
          name: 'test.jpg',
          parentId: 'folder-id-AM-mock',
          mimeType: 'image/jpeg',
        };

        return new Response(
          JSON.stringify({
            id: fileId,
            name: fileMeta.name,
            mimeType: fileMeta.mimeType,
            size: '1024',
            parents: [fileMeta.parentId, 'folder-id-AM-mock', 'folder-id-PM-mock'],
            trashed: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not found in mock', { status: 404 });
    });
  });

  it('GET /api/health returns health status', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string; service: string };
    expect(data.status).toBe('ok');
    expect(data.service).toBe('mmu-photo-portal-worker');
  });

  it('POST /api/drive/initialize repairs missing directories and achieves 18/18 verification', async () => {
    const req = new Request('http://localhost/api/drive/initialize', { method: 'POST' });
    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      totalExpected: number;
      totalVerified: number;
      repairedCount: number;
      status: string;
    };

    expect(data.totalExpected).toBe(18);
    expect(data.totalVerified).toBe(18);
    // 9 MMUs + 18 subdirectories = 27 repaired paths
    expect(data.repairedCount).toBe(27);
    expect(data.status).toBe('verified');
  });

  it('GET /api/drive/status detects existing directories after initialization', async () => {
    // First initialize
    const initReq = new Request('http://localhost/api/drive/initialize', { method: 'POST' });
    await worker.fetch(initReq, mockEnv, {} as ExecutionContext);

    // Now call status
    const statusReq = new Request('http://localhost/api/drive/status');
    const res = await worker.fetch(statusReq, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      totalExpected: number;
      totalVerified: number;
      repairedCount: number;
      status: string;
      message: string;
    };

    expect(data.totalExpected).toBe(18);
    expect(data.totalVerified).toBe(18);
    expect(data.repairedCount).toBe(0); // already exists, no repair needed
    expect(data.status).toBe('verified');
    expect(data.message).toContain('18/18 Directories Verified');
  });

  // Section 12 Upload Tests:
  it('Test 1: Upload MMU-003 / AM / 1 JPG image', async () => {
    // Pre-populate folders
    createdDriveFolders.set('root-storage-id:MMU-003', 'mmu3-id');
    createdDriveFolders.set('mmu3-id:AM', 'folder-id-AM-mock');

    const form = new FormData();
    form.append('mmu', 'MMU-003');
    form.append('session', 'AM');
    const file = new File([JPEG_HEADER], 'test.jpg', { type: 'image/jpeg' });
    form.append('photos', file);

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      mmu: string;
      session: string;
      destination: string;
      total: number;
      successful: number;
      failed: number;
      results: Array<{ filename: string; success: boolean }>;
    };

    expect(data.mmu).toBe('MMU-003');
    expect(data.session).toBe('AM');
    expect(data.destination).toBe('MMU-PHOTO-STORAGE/MMU-003/AM/');
    expect(data.total).toBe(1);
    expect(data.successful).toBe(1);
    expect(data.failed).toBe(0);
    expect(data.results[0].success).toBe(true);
  });

  it('Test 2: Upload MMU-106 / PM / 5 JPG images', async () => {
    createdDriveFolders.set('root-storage-id:MMU-106', 'mmu106-id');
    createdDriveFolders.set('mmu106-id:PM', 'folder-id-PM-mock');

    const form = new FormData();
    form.append('mmu', 'MMU-106');
    form.append('session', 'PM');

    for (let i = 1; i <= 5; i++) {
      const file = new File([JPEG_HEADER], 'test.jpg', { type: 'image/jpeg' });
      form.append('photos', file);
    }

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      total: number;
      successful: number;
      failed: number;
    };
    expect(data.total).toBe(5);
    expect(data.successful).toBe(5);
    expect(data.failed).toBe(0);
  });

  it('Test 3: Upload MMU-101 / AM / 3 PNG images', async () => {
    createdDriveFolders.set('root-storage-id:MMU-101', 'mmu101-id');
    createdDriveFolders.set('mmu101-id:AM', 'folder-id-AM-mock');

    const form = new FormData();
    form.append('mmu', 'MMU-101');
    form.append('session', 'AM');

    for (let i = 1; i <= 3; i++) {
      const file = new File([PNG_HEADER], `photo_${i}.png`, { type: 'image/png' });
      form.append('photos', file);
    }

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      total: number;
      successful: number;
      failed: number;
      destination: string;
    };
    expect(data.total).toBe(3);
    expect(data.successful).toBe(3);
    expect(data.failed).toBe(0);
    expect(data.destination).toBe('MMU-PHOTO-STORAGE/MMU-101/AM/');
  });

  it('Test 4: Upload MMU-091 / PM / Multiple mixed JPG and PNG images', async () => {
    createdDriveFolders.set('root-storage-id:MMU-091', 'mmu091-id');
    createdDriveFolders.set('mmu091-id:PM', 'folder-id-PM-mock');

    const form = new FormData();
    form.append('mmu', 'MMU-091');
    form.append('session', 'PM');

    // 2 JPGs and 2 PNGs
    form.append('photos', new File([JPEG_HEADER], 'image1.jpg', { type: 'image/jpeg' }));
    form.append('photos', new File([JPEG_HEADER], 'image2.jpeg', { type: 'image/jpeg' }));
    form.append('photos', new File([PNG_HEADER], 'image3.png', { type: 'image/png' }));
    form.append('photos', new File([PNG_HEADER], 'image4.png', { type: 'image/png' }));

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      total: number;
      successful: number;
      failed: number;
      destination: string;
      results: Array<{ filename: string; mimeType: string; success: boolean }>;
    };
    expect(data.total).toBe(4);
    expect(data.successful).toBe(4);
    expect(data.failed).toBe(0);
    expect(data.destination).toBe('MMU-PHOTO-STORAGE/MMU-091/PM/');
  });

  it('Test 5: Rejects upload with no MMU selected', async () => {
    const form = new FormData();
    form.append('session', 'AM');
    form.append('photos', new File([JPEG_HEADER], 'test.jpg', { type: 'image/jpeg' }));

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Invalid or missing MMU parameter');
  });

  it('Test 6: Rejects upload with no session selected', async () => {
    const form = new FormData();
    form.append('mmu', 'MMU-003');
    form.append('photos', new File([JPEG_HEADER], 'test.jpg', { type: 'image/jpeg' }));

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Invalid or missing Session parameter');
  });

  it('Test 7: Rejects upload with no image selected', async () => {
    const form = new FormData();
    form.append('mmu', 'MMU-004');
    form.append('session', 'PM');

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('No photographs were provided');
  });

  it('Test 8: Rejects unsupported file (e.g. document.pdf)', async () => {
    const form = new FormData();
    form.append('mmu', 'MMU-091');
    form.append('session', 'AM');
    const fakeFile = new File(['%PDF-1.5 fake content'], 'document.pdf', { type: 'application/pdf' });
    form.append('photos', fakeFile);

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Unsupported file extension');
  });

  it('Test 9: Rejects oversized image (> MAX_FILE_SIZE_MB)', async () => {
    const customEnv: Env = {
      ...mockEnv,
      MAX_FILE_SIZE_MB: '1', // 1 MB limit
    };

    const form = new FormData();
    form.append('mmu', 'MMU-107');
    form.append('session', 'PM');

    // Create a 1.2 MB file with valid JPEG header
    const largeBuffer = new Uint8Array(1.2 * 1024 * 1024);
    largeBuffer.set(JPEG_HEADER, 0);

    const file = new File([largeBuffer], 'large.jpg', { type: 'image/jpeg' });
    form.append('photos', file);

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, customEnv, {} as ExecutionContext);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('exceeds maximum allowed size');
  });

  it('Test 10: Handles upload interruption gracefully without leaking secrets', async () => {
    // Force upload to fail
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    const form = new FormData();
    form.append('mmu', 'MMU-108');
    form.append('session', 'AM');
    form.append('photos', new File([JPEG_HEADER], 'test.jpg', { type: 'image/jpeg' }));

    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: form,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(502);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Destination folder resolution failed');
    // Ensure secrets are never leaked
    expect(data.error).not.toContain('test-client-secret');
    expect(data.error).not.toContain('test-refresh-token');
  });
});
