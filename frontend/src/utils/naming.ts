import { SessionType } from '../types';

const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

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

export function formatTargetFilename(
  session: SessionType,
  originalFilename: string,
  index = 0,
  totalInBatch = 1,
  date: Date = new Date()
): string {
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
