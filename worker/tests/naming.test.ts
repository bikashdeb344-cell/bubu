import { describe, it, expect } from 'vitest';
import {
  extractExifDate,
  generateTargetFilename,
  getISTDateParts,
  parseDateFromFilename,
  resolvePhotoDate,
} from '../src/naming';

describe('Naming Utility Tests', () => {
  const fixedDate = new Date('2026-11-18T10:00:00Z'); // In IST (UTC+5:30), this is 2026-11-18 15:30:00

  it('formats IST date parts correctly', () => {
    const parts = getISTDateParts(fixedDate);
    expect(parts.day).toBe('18');
    expect(parts.month).toBe('NOV');
    expect(parts.year).toBe('26');
  });

  it('handles late night UTC transitioning to next day in IST', () => {
    // 2026-11-18 20:00:00 UTC = 2026-11-19 01:30:00 IST
    const lateUtcDate = new Date('2026-11-18T20:00:00Z');
    const parts = getISTDateParts(lateUtcDate);
    expect(parts.day).toBe('19');
    expect(parts.month).toBe('NOV');
    expect(parts.year).toBe('26');
  });

  it('names a single AM photo as DD-MONTH-YY IN-PHOTO.jpg', () => {
    const name = generateTargetFilename('AM', 'camera_capture_123.jpg', 0, 1, fixedDate);
    expect(name).toBe('18-NOV-26 IN-PHOTO.jpg');
  });

  it('names a single PM photo as DD-MONTH-YY OUT-PHOTO.png', () => {
    const name = generateTargetFilename('PM', 'my_screenshot.PNG', 0, 1, fixedDate);
    expect(name).toBe('18-NOV-26 OUT-PHOTO.png');
  });

  it('numbers multiple photos in AM batch with -1, -2 suffix', () => {
    const name1 = generateTargetFilename('AM', 'van_front.jpeg', 0, 3, fixedDate);
    const name2 = generateTargetFilename('AM', 'van_side.jpeg', 1, 3, fixedDate);
    const name3 = generateTargetFilename('AM', 'van_rear.jpeg', 2, 3, fixedDate);

    expect(name1).toBe('18-NOV-26 IN-PHOTO-1.jpeg');
    expect(name2).toBe('18-NOV-26 IN-PHOTO-2.jpeg');
    expect(name3).toBe('18-NOV-26 IN-PHOTO-3.jpeg');
  });

  it('numbers multiple photos in PM batch with -1, -2 suffix', () => {
    const name1 = generateTargetFilename('PM', 'checkout_1.webp', 0, 2, fixedDate);
    const name2 = generateTargetFilename('PM', 'checkout_2.webp', 1, 2, fixedDate);

    expect(name1).toBe('18-NOV-26 OUT-PHOTO-1.webp');
    expect(name2).toBe('18-NOV-26 OUT-PHOTO-2.webp');
  });

  it('preserves file extension correctly and falls back to .jpg if extension is missing', () => {
    const nameNoExt = generateTargetFilename('AM', 'rawphoto', 0, 1, fixedDate);
    expect(nameNoExt).toBe('18-NOV-26 IN-PHOTO.jpg');

    const namePng = generateTargetFilename('AM', 'photo.png', 0, 1, fixedDate);
    expect(namePng).toBe('18-NOV-26 IN-PHOTO.png');
  });

  describe('Image Date Extraction Tests (User Requirement)', () => {
    it('extracts date from filename with YYYY-MM-DD pattern (e.g. Screenshot)', () => {
      const filename = 'Screenshot 2026-11-14 102030.png';
      const targetName = generateTargetFilename('AM', filename, 0, 1);
      expect(targetName).toBe('14-NOV-26 IN-PHOTO.png');
    });

    it('extracts date from camera naming with YYYYMMDD pattern (e.g. IMG_YYYYMMDD_HHMMSS)', () => {
      const filename = 'IMG_20261025_143000.jpg';
      const targetName = generateTargetFilename('PM', filename, 0, 1);
      expect(targetName).toBe('25-OCT-26 OUT-PHOTO.jpg');
    });

    it('extracts date from WhatsApp naming (e.g. WhatsApp Image YYYY-MM-DD at ...)', () => {
      const filename = 'WhatsApp Image 2026-11-12 at 09.15.30.jpeg';
      const targetName = generateTargetFilename('AM', filename, 0, 1);
      expect(targetName).toBe('12-NOV-26 IN-PHOTO.jpeg');
    });

    it('extracts date from DD-MM-YYYY filename pattern', () => {
      const filename = '05-11-2026_photo.jpg';
      const targetName = generateTargetFilename('PM', filename, 0, 1);
      expect(targetName).toBe('05-NOV-26 OUT-PHOTO.jpg');
    });

    it('extracts date from DD-MMM-YYYY filename pattern', () => {
      const filename = 'photo_10-OCT-2026.png';
      const targetName = generateTargetFilename('AM', filename, 0, 1);
      expect(targetName).toBe('10-OCT-26 IN-PHOTO.png');
    });

    it('extracts date from EXIF metadata bytes when present', () => {
      // Construct a mock JPEG header containing Exif ASCII date
      const prefix = 'FFD8FFE1003045786966000049492A0008000000';
      const dateStr = Buffer.from('2026:09:15 11:20:00').toString('hex');
      const suffix = 'FFD9';
      const mockBytes = new Uint8Array(Buffer.from(prefix + dateStr + suffix, 'hex'));

      const extracted = extractExifDate(mockBytes);
      expect(extracted).not.toBeNull();

      // Passing bytes with generic filename should use EXIF date: 15-SEP-26
      const targetName = generateTargetFilename('AM', 'generic_photo.jpg', 0, 1, mockBytes);
      expect(targetName).toBe('15-SEP-26 IN-PHOTO.jpg');
    });

    it('falls back to current date when image contains no date in EXIF or filename', () => {
      const filename = 'plain_photo.jpg';
      const targetName = generateTargetFilename('AM', filename, 0, 1, fixedDate);
      expect(targetName).toBe('18-NOV-26 IN-PHOTO.jpg');
    });
  });
});
