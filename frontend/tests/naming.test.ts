import { describe, it, expect } from 'vitest';
import { formatTargetFilename, parseDateFromFilename, getISTDateParts } from '../src/utils/naming';

describe('Frontend Naming Utilities', () => {
  const fixedDate = new Date('2026-11-18T10:00:00Z');

  it('formats IST date parts with 4-digit year', () => {
    const parts = getISTDateParts(fixedDate);
    expect(parts.day).toBe('18');
    expect(parts.month).toBe('NOV');
    expect(parts.year).toBe('2026');
  });

  it('matches user case: 20261025_192724.jpg -> [25 OCT 2026 IN-photo].jpg (AM)', () => {
    const target = formatTargetFilename('AM', '20261025_192724.jpg', 0, 1, fixedDate);
    expect(target).toBe('[25 OCT 2026 IN-photo].jpg');
  });

  it('matches user case: 20261025_192724.jpg -> [25 OCT 2026 OUT-photo].jpg (PM)', () => {
    const target = formatTargetFilename('PM', '20261025_192724.jpg', 0, 1, fixedDate);
    expect(target).toBe('[25 OCT 2026 OUT-photo].jpg');
  });

  it('matches WhatsApp case: IMG-20261117-WA0061.jpg -> [17 NOV 2026 IN-photo].jpg', () => {
    const target = formatTargetFilename('AM', 'IMG-20261117-WA0061.jpg', 0, 1, fixedDate);
    expect(target).toBe('[17 NOV 2026 IN-photo].jpg');
  });

  it('matches WhatsApp case: IMG-20261116-WA0015.jpg -> [16 NOV 2026 OUT-photo].jpg', () => {
    const target = formatTargetFilename('PM', 'IMG-20261116-WA0015.jpg', 0, 1, fixedDate);
    expect(target).toBe('[16 NOV 2026 OUT-photo].jpg');
  });

  it('formats multiple files with sequential numbering', () => {
    const file1 = formatTargetFilename('AM', 'IMG-20261117-WA0061.jpg', 0, 2, fixedDate);
    const file2 = formatTargetFilename('AM', 'IMG-20261117-WA0062.jpg', 1, 2, fixedDate);
    expect(file1).toBe('[17 NOV 2026 IN-photo-1].jpg');
    expect(file2).toBe('[17 NOV 2026 IN-photo-2].jpg');
  });

  it('parses dates from various filename patterns', () => {
    const d1 = parseDateFromFilename('20261025_192724.jpg');
    expect(d1).not.toBeNull();
    expect(d1?.getUTCFullYear()).toBe(2026);
    expect(d1?.getUTCMonth()).toBe(9); // Oct is 9
    expect(d1?.getUTCDate()).toBe(25);

    const d2 = parseDateFromFilename('IMG-20261117-WA0061.jpg');
    expect(d2).not.toBeNull();
    expect(d2?.getUTCDate()).toBe(17);
  });
});
