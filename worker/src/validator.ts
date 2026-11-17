import { MMUId, SessionType, VALID_MMUS, VALID_SESSIONS } from './types';

export interface FileValidationResult {
  valid: boolean;
  detectedMime?: string;
  error?: string;
}

/**
 * Validates file magic bytes (signatures) to ensure genuine images.
 * JPEG: FF D8 FF
 * PNG:  89 50 4E 47 0D 0A 1A 0A
 * WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
 */
export function validateImageSignature(bytes: Uint8Array): FileValidationResult {
  if (bytes.length < 12) {
    return { valid: false, error: 'File is too small to be a valid image header.' };
  }

  // Check JPEG (FF D8 FF)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // Check PNG (89 50 4E 47 0D 0A 1A 0A)
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png' };
  }

  // Check WEBP (RIFF....WEBP)
  const isRiff =
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46; // 'F'

  const isWebp =
    bytes[8] === 0x57 && // 'W'
    bytes[9] === 0x45 && // 'E'
    bytes[10] === 0x42 && // 'B'
    bytes[11] === 0x50; // 'P'

  if (isRiff && isWebp) {
    return { valid: true, detectedMime: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Invalid file signature. File is not a valid JPEG, PNG, or WEBP image.',
  };
}

/**
 * Validates file extension
 */
export function validateFileExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp';
}

/**
 * Validates MMU parameter
 */
export function isValidMMU(mmu: unknown): mmu is MMUId {
  return typeof mmu === 'string' && (VALID_MMUS as readonly string[]).includes(mmu);
}

/**
 * Validates Session parameter
 */
export function isValidSession(session: unknown): session is SessionType {
  return typeof session === 'string' && (VALID_SESSIONS as readonly string[]).includes(session);
}

/**
 * Validates a single uploaded file
 */
export function validateUploadedFile(
  file: File,
  bytes: Uint8Array,
  maxSizeBytes: number
): { valid: boolean; error?: string; mimeType: string } {
  // 1. Check extension
  if (!validateFileExtension(file.name)) {
    return {
      valid: false,
      error: `Unsupported file extension for "${file.name}". Only JPG, JPEG, PNG, and WEBP are permitted.`,
      mimeType: file.type || 'application/octet-stream',
    };
  }

  // 2. Check size
  if (file.size > maxSizeBytes) {
    const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of ${maxMB} MB.`,
      mimeType: file.type || 'application/octet-stream',
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: `File "${file.name}" is empty (0 bytes).`,
      mimeType: file.type || 'application/octet-stream',
    };
  }

  // 3. Check magic bytes
  const sig = validateImageSignature(bytes);
  if (!sig.valid) {
    return {
      valid: false,
      error: `Signature check failed for "${file.name}": ${sig.error}`,
      mimeType: file.type || 'application/octet-stream',
    };
  }

  return {
    valid: true,
    mimeType: sig.detectedMime || file.type || 'image/jpeg',
  };
}
