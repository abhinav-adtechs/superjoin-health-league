/** Same window as logging: today and up to `MAX_DAYS_BACK` calendar days in the past. */

export const MAX_DAYS_BACK = 4;

export function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
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
