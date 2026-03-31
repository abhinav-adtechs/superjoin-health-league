/**
 * DiceBear avataaars — deterministic per seed. Prefer `userId` as seed so the
 * avatar stays stable if the display name changes.
 */
export function dicebearAvatarUrl(seed: string): string {
  const s = seed.trim() || 'user';
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(s)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

/** Variants for the profile avatar picker (same style, different seeds). */
export function dicebearAvatarPickerSeeds(displayName: string): string[] {
  const base = displayName.replace(/\s+/g, '') || 'user';
  return [base, `${base}2`, `${base}3`, `${base}x`, `${base}pro`, `${base}7`];
}

/** Uses stored avatar when set; otherwise auto-generates from user id. */
export function resolveAvatarUrl(opts: {
  userId: string;
  displayName: string;
  avatarUrl: string | null | undefined;
}): string {
  const trimmed = opts.avatarUrl?.trim();
  if (trimmed) return trimmed;
  return dicebearAvatarUrl(opts.userId || opts.displayName || 'user');
}
