import { describe, it, expect } from 'vitest';
import { generateTargetFilename, getISTDateParts } from '../src/naming';

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
});
