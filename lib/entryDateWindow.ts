/** Same window as logging: today and up to `MAX_DAYS_BACK` calendar days in the past. */

export const MAX_DAYS_BACK = 4;

/** Removing log lines (PATCH clear): today and the previous 2 calendar days only. */
export const MAX_DELETE_DAYS_BACK = 2;

/**
 * Postgres DATE / Supabase rows sometimes serialize `date` as full ISO (`2026-04-04T00:00:00+00:00`).
 * APIs and `.eq('date', …)` need the plain `YYYY-MM-DD` calendar key.
 */
export function normalizeYmd(s: string | unknown): string | null {
  if (s == null || s === '') return null;
  if (s instanceof Date) {
    if (isNaN(s.getTime())) return null;
    return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
  }
  const str = typeof s === 'string' ? s : String(s);
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/** Local calendar YYYY-MM-DD (browser = user; use only on client for UI + request anchors). */
export function getLocalDateString(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Pure calendar arithmetic on YYYY-MM-DD (UTC date parts, no timezone shift). */
export function addDaysToDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + deltaDays);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/**
 * True if `dateStr` is on or before `anchorStr` (usually client's "today") and not before
 * anchor minus `maxDaysBack` calendar days. Compares ISO date strings lexicographically.
 */
export function isDateWithinAnchorRange(
  dateStr: string,
  anchorStr: string,
  maxDaysBack: number,
): boolean {
  const d = normalizeYmd(dateStr);
  const a = normalizeYmd(anchorStr);
  if (!d || !a) return false;
  if (d > a) return false;
  const minStr = addDaysToDateString(a, -maxDaysBack);
  return d >= minStr;
}

/**
 * Fallback when `client_today` is absent: UTC calendar days vs entry date, ±1 day slack for
 * timezone skew (API on UTC vs user-stored local calendar dates).
 */
export function isWithinAllowedPastRangeUtcSlack(dateStr: string, maxDaysBack: number): boolean {
  const norm = normalizeYmd(dateStr);
  if (!norm) return false;
  const [y, m, d] = norm.split('-').map(Number);
  const entryUtc = Date.UTC(y, m - 1, d);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.round((todayUtc - entryUtc) / 86400000);
  if (diffDays < -1) return false;
  if (diffDays > maxDaysBack + 1) return false;
  return true;
}

export function isWithinAllowedPastRange(
  dateStr: string,
  maxDaysBack: number = MAX_DAYS_BACK,
): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dTime = d.getTime();
  const todayTime = today.getTime();
  if (dTime > todayTime) return false;
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - maxDaysBack);
  minDate.setHours(12, 0, 0, 0);
  return dTime >= minDate.getTime();
}
