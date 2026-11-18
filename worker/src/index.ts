import {
  getAccessToken,
  getDestinationFolderId,
  uploadFileToDrive,
  validateAndRepairDriveStructure,
  verifyUploadedFileInDrive,
} from './google-drive';
import {
  Env,
  UploadFileResult,
  UploadResponse,
} from './types';
import {
  isValidMMU,
  isValidSession,
  validateUploadedFile,
} from './validator';
import { generateTargetFilename } from './naming';

// Simple in-memory rate limiter for abuse prevention
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientIp: string, maxRequests = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Creates standardized CORS headers
 */
function createCorsHeaders(env: Env, request: Request): Headers {
  const headers = new Headers();
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const requestOrigin = request.headers.get('Origin');

  if (allowedOrigin === '*') {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && requestOrigin === allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
  } else {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

/**
 * Creates a JSON response with CORS headers
 */
function jsonResponse(data: unknown, status = 200, env: Env, request: Request): Response {
  const headers = createCorsHeaders(env, request);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // 1. Handle CORS Preflight
    if (method === 'OPTIONS') {
      const headers = createCorsHeaders(env, request);
      return new Response(null, { status: 204, headers });
    }

    // 2. Abuse Prevention / Rate Limiting
    const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
    if (!checkRateLimit(clientIp)) {
      return jsonResponse(
        { error: 'Rate limit exceeded. Please wait a moment before sending more requests.' },
        429,
        env,
        request
      );
    }

    try {
      // 3. Routing
      if (method === 'GET' && url.pathname === '/api/health') {
        return jsonResponse(
          {
            status: 'ok',
            service: 'mmu-photo-portal-worker',
            timestamp: new Date().toISOString(),
          },
          200,
          env,
          request
        );
      }

      if (method === 'GET' && url.pathname === '/api/drive/status') {
        const status = await validateAndRepairDriveStructure(env, false);
        return jsonResponse(status, 200, env, request);
      }

      if (method === 'POST' && url.pathname === '/api/drive/initialize') {
        // Auto-repair missing folders
        const status = await validateAndRepairDriveStructure(env, true);
        return jsonResponse(status, 200, env, request);
      }

      if (method === 'POST' && url.pathname === '/api/upload') {
        return await handleUpload(request, env);
      }

      return jsonResponse({ error: 'Endpoint not found' }, 404, env, request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      // Do not leak secrets or internal stacks
      return jsonResponse({ error: message }, 500, env, request);
    }
  },
};

/**
 * Handles multipart/form-data photo upload
 */
async function handleUpload(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse(
      { error: 'Invalid content type. Expected multipart/form-data.' },
      400,
      env,
      request
    );
  }

  // Parse limits
  const maxMb = parseInt(env.MAX_FILE_SIZE_MB || '15', 10);
  const maxSizeBytes = maxMb * 1024 * 1024;
  const maxFiles = parseInt(env.MAX_FILES_PER_UPLOAD || '20', 10);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err: unknown) {
    return jsonResponse(
      { error: 'Failed to parse upload request payload. File may be too large or truncated.' },
      400,
      env,
      request
    );
  }

  const mmu = formData.get('mmu');
  const session = formData.get('session');

  // Validate MMU
  if (!isValidMMU(mmu)) {
    return jsonResponse(
      { error: 'Invalid or missing MMU parameter.' },
      400,
      env,
      request
    );
  }

  // Validate Session
  if (!isValidSession(session)) {
    return jsonResponse(
      { error: 'Invalid or missing Session parameter. Must be "AM" or "PM".' },
      400,
      env,
      request
    );
  }

  // Extract files
  const files: File[] = [];
  for (const [key, val] of formData.entries()) {
    if (key === 'photos' || key === 'files' || key === 'images' || key.startsWith('file')) {
      if (typeof val === 'object' && val !== null && 'size' in val && (val as File).size > 0) {
        files.push(val as File);
      }
    }
  }

  if (files.length === 0) {
    return jsonResponse(
      { error: 'No photographs were provided in the upload request.' },
      400,
      env,
      request
    );
  }

  if (files.length > maxFiles) {
    return jsonResponse(
      { error: `Exceeded maximum allowable files per submission. Limit is ${maxFiles}, received ${files.length}.` },
      400,
      env,
      request
    );
  }

  // Pre-validate all files
  const validatedFiles: Array<{
    file: File;
    bytes: Uint8Array;
    mimeType: string;
  }> = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const validation = validateUploadedFile(file, bytes, maxSizeBytes);
    if (!validation.valid) {
      return jsonResponse(
        { error: validation.error || `Validation failed for file ${file.name}` },
        400,
        env,
        request
      );
    }

    validatedFiles.push({
      file,
      bytes,
      mimeType: validation.mimeType,
    });
  }

  // Obtain destination folder ID (creates if missing)
  let destinationFolderId: string;
  let accessToken: string;
  try {
    accessToken = await getAccessToken(env);
    destinationFolderId = await getDestinationFolderId(env, mmu, session);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Google Drive connection failed';
    return jsonResponse({ error: `Destination folder resolution failed: ${msg}` }, 502, env, request);
  }

  const destinationPath = `MMU-PHOTO-STORAGE/${mmu}/${session}/`;
  const results: UploadFileResult[] = [];
  let successful = 0;
  let failed = 0;

  // Upload each file individually with standardized renaming and track results
  for (let i = 0; i < validatedFiles.length; i++) {
    const item = validatedFiles[i];
    const targetFilename = generateTargetFilename(
      session,
      item.file.name,
      i,
      validatedFiles.length
    );

    try {
      // 1. Upload to Drive with standardized filename: DD-MONTH-YY {IN-PHOTO|OUT-PHOTO}[-N].ext
      const uploaded = await uploadFileToDrive(
        accessToken,
        destinationFolderId,
        targetFilename,
        item.mimeType,
        item.bytes
      );

      // 2. Post-upload verification in Drive (Section 12.D)
      const verification = await verifyUploadedFileInDrive(
        accessToken,
        uploaded.id,
        destinationFolderId,
        targetFilename,
        item.mimeType
      );

      if (!verification.verified) {
        throw new Error(verification.error || 'Post-upload Drive verification failed');
      }

      results.push({
        filename: targetFilename,
        success: true,
        fileId: uploaded.id,
        drivePath: `${destinationPath}${targetFilename}`,
        size: item.file.size,
        mimeType: item.mimeType,
      });
      successful++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      results.push({
        filename: targetFilename,
        success: false,
        error: errorMsg,
        size: item.file.size,
        mimeType: item.mimeType,
      });
      failed++;
    }
  }

  const responsePayload: UploadResponse = {
    mmu,
    session,
    destination: destinationPath,
    total: validatedFiles.length,
    successful,
    failed,
    results,
  };

  const httpStatus = failed === 0 ? 200 : successful > 0 ? 207 : 502;
  return jsonResponse(responsePayload, httpStatus, env, request);
}
