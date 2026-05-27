/** Map NL portion hints to preset keys (server-side, after Gemini). */

const SIZE_TO_KEY: Record<string, string> = {
  small: 'small',
  sm: 'small',
  little: 'small',
  half: 'small',
  thoda: 'small',
  kam: 'small',
  regular: 'regular',
  medium: 'regular',
  normal: 'regular',
  large: 'large',
  lg: 'large',
  big: 'large',
  full: 'large',
  zyada: 'large',
  double: 'large',
  extra: 'large',
};

export function mapPortionSizeToKey(portionSize: string | null | undefined): string | null {
  if (!portionSize) return null;
  const n = portionSize.trim().toLowerCase();
  return SIZE_TO_KEY[n] ?? null;
}
