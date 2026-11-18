import { SessionType } from '../types';

const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function getISTDateParts(date: Date = new Date()): { day: string; month: string; year: string } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    const month = (parts.find((p) => p.type === 'month')?.value || 'JAN').toUpperCase();
    const year = parts.find((p) => p.type === 'year')?.value || '26';
    return { day, month, year };
  } catch {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffsetMs);
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    const month = MONTH_NAMES[istDate.getUTCMonth()];
    const year = String(istDate.getUTCFullYear()).slice(-2);
    return { day, month, year };
  }
}

/**
 * Parses embedded date patterns from a photo filename.
 */
export function parseDateFromFilename(filename: string): Date | null {
  if (!filename) return null;

  // Pattern 1: YYYY-MM-DD or YYYY_MM_DD or YYYY.MM.DD
  const m1 = filename.match(/(?:^|[^0-9])(20\d{2})[-_. ](0[1-9]|1[0-2])[-_. ](0[1-9]|[12]\d|3[01])(?:$|[^0-9])/);
  if (m1) {
    return new Date(Date.UTC(parseInt(m1[1], 10), parseInt(m1[2], 10) - 1, parseInt(m1[3], 10), 12, 0, 0));
  }

  // Pattern 2: YYYYMMDD (e.g. IMG_20261115_142305, PXL_20261112_090015)
  const m2 = filename.match(/(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:$|[^0-9])/);
  if (m2) {
    return new Date(Date.UTC(parseInt(m2[1], 10), parseInt(m2[2], 10) - 1, parseInt(m2[3], 10), 12, 0, 0));
  }

  // Pattern 3: DD-MM-YYYY or DD_MM_YYYY or DD.MM.YYYY
  const m3 = filename.match(/(?:^|[^0-9])(0[1-9]|[12]\d|3[01])[-_. ](0[1-9]|1[0-2])[-_. ](20\d{2})(?:$|[^0-9])/);
  if (m3) {
    return new Date(Date.UTC(parseInt(m3[3], 10), parseInt(m3[2], 10) - 1, parseInt(m3[1], 10), 12, 0, 0));
  }

  // Pattern 4: DD-MMM-YYYY or DD-MMM-YY
  const m4 = filename.match(/(?:^|[^0-9a-zA-Z])(0[1-9]|[12]\d|3[01])[-_. ]([a-zA-Z]{3,9})[-_. ](20\d{2}|\d{2})(?:$|[^0-9a-zA-Z])/);
  if (m4) {
    const monthKey = m4[2].toLowerCase();
    if (monthKey in MONTH_MAP) {
      const yearStr = m4[3].length === 2 ? `20${m4[3]}` : m4[3];
      return new Date(Date.UTC(parseInt(yearStr, 10), MONTH_MAP[monthKey], parseInt(m4[1], 10), 12, 0, 0));
    }
  }

  return null;
}

export function formatTargetFilename(
  session: SessionType,
  originalFilename: string,
  index = 0,
  totalInBatch = 1,
  fallbackDate: Date = new Date()
): string {
  const date = parseDateFromFilename(originalFilename) || fallbackDate;
  const { day, month, year } = getISTDateParts(date);
  const tag = session === 'AM' ? 'IN-PHOTO' : 'OUT-PHOTO';

  const lastDot = originalFilename.lastIndexOf('.');
  const ext = lastDot !== -1 ? originalFilename.slice(lastDot).toLowerCase() : '.jpg';

  if (totalInBatch > 1) {
    const fileNumber = index + 1;
    return `${day}-${month}-${year} ${tag}-${fileNumber}${ext}`;
  }

  return `${day}-${month}-${year} ${tag}${ext}`;
}
