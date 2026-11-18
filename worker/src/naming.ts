import { SessionType } from './types';

const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/**
 * Returns date components (DD, MONTH, YY) formatted in Indian Standard Time (Asia/Kolkata).
 */
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
    // Fallback if Intl formatToParts is unavailable
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffsetMs);
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    const month = MONTH_NAMES[istDate.getUTCMonth()];
    const year = String(istDate.getUTCFullYear()).slice(-2);
    return { day, month, year };
  }
}

/**
 * Generates the standardized filename for an MMU photo upload.
 * AM photos: DD-MONTH-YY IN-PHOTO.ext (or DD-MONTH-YY IN-PHOTO-1.ext if multiple)
 * PM photos: DD-MONTH-YY OUT-PHOTO.ext (or DD-MONTH-YY OUT-PHOTO-1.ext if multiple)
 */
export function generateTargetFilename(
  session: SessionType,
  originalFilename: string,
  index = 0,
  totalInBatch = 1,
  date: Date = new Date()
): string {
  const { day, month, year } = getISTDateParts(date);
  const tag = session === 'AM' ? 'IN-PHOTO' : 'OUT-PHOTO';

  // Extract extension safely, defaulting to .jpg if missing
  const lastDot = originalFilename.lastIndexOf('.');
  const ext = lastDot !== -1 ? originalFilename.slice(lastDot).toLowerCase() : '.jpg';

  // If more than 1 photo in the batch, append -1, -2, etc. (1-based index)
  if (totalInBatch > 1) {
    const fileNumber = index + 1;
    return `${day}-${month}-${year} ${tag}-${fileNumber}${ext}`;
  }

  return `${day}-${month}-${year} ${tag}${ext}`;
}
