import { describe, it, expect } from 'vitest';
import {
  validateImageSignature,
  validateFileExtension,
  isValidMMU,
  isValidSession,
  validateUploadedFile,
} from '../src/validator';

describe('Validator Unit Tests', () => {
  it('validates JPEG magic bytes (FF D8 FF)', () => {
    const validJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = validateImageSignature(validJpeg);
    expect(res.valid).toBe(true);
    expect(res.detectedMime).toBe('image/jpeg');
  });

  it('validates PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const res = validateImageSignature(validPng);
    expect(res.valid).toBe(true);
    expect(res.detectedMime).toBe('image/png');
  });

  it('validates WEBP magic bytes (RIFF....WEBP)', () => {
    const validWebp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // 'RIFF'
      0x20, 0x00, 0x00, 0x00, // file length
      0x57, 0x45, 0x42, 0x50, // 'WEBP'
    ]);
    const res = validateImageSignature(validWebp);
    expect(res.valid).toBe(true);
    expect(res.detectedMime).toBe('image/webp');
  });

  it('rejects fake/unsupported files (e.g. PDF or text disguised as JPG)', () => {
    // PDF signature %PDF
    const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x00, 0x00, 0x00, 0x00]);
    const res = validateImageSignature(fakePdf);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Invalid file signature');
  });

  it('validates file extensions strictly', () => {
    expect(validateFileExtension('photo.jpg')).toBe(true);
    expect(validateFileExtension('photo.jpeg')).toBe(true);
    expect(validateFileExtension('photo.png')).toBe(true);
    expect(validateFileExtension('photo.webp')).toBe(true);
    expect(validateFileExtension('photo.JPG')).toBe(true);
    expect(validateFileExtension('script.js')).toBe(false);
    expect(validateFileExtension('document.pdf')).toBe(false);
    expect(validateFileExtension('malware.exe')).toBe(false);
  });

  it('validates MMU ID strictly', () => {
    expect(isValidMMU('MMU-003')).toBe(true);
    expect(isValidMMU('MMU-106')).toBe(true);
    expect(isValidMMU('MMU-101')).toBe(true);
    expect(isValidMMU('MMU-999')).toBe(false);
    expect(isValidMMU('MMU-000')).toBe(false);
    expect(isValidMMU('')).toBe(false);
    expect(isValidMMU(null)).toBe(false);
  });

  it('validates Session strictly', () => {
    expect(isValidSession('AM')).toBe(true);
    expect(isValidSession('PM')).toBe(true);
    expect(isValidSession('NOON')).toBe(false);
    expect(isValidSession('')).toBe(false);
    expect(isValidSession(undefined)).toBe(false);
  });

  it('enforces maximum file size limit', () => {
    const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const file = new File([validJpegBytes], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 16 * 1024 * 1024 }); // 16 MB

    const result = validateUploadedFile(file, validJpegBytes, 15 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum allowed size');
  });
});
