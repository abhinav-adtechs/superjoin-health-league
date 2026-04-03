import { createClient } from '@/lib/supabase/client';

/**
 * API base URL for fetch() calls.
 * - Web (Next.js dev/server or same-origin deploy): use '' so relative /api works.
 * - iOS/Android (Capacitor): set NEXT_PUBLIC_API_BASE_URL to your deployed app URL
 *   (e.g. https://your-app.vercel.app) so the native app hits your backend.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  return base.replace(/\/$/, '');
}

/** Default fetch options for API calls: send cookies when using a separate API origin (e.g. Capacitor). */
export function getApiFetchOptions(init?: RequestInit): RequestInit {
  const base = getApiBaseUrl();
  const credentials = base ? ('include' as RequestCredentials) : undefined;
  return { ...init, credentials: init?.credentials ?? credentials };
}

/** Full URL for an API path (path should start with /). */
export function apiUrl(path: string): string {
  return getApiBaseUrl() + (path.startsWith('/') ? path : '/' + path);
}

/** Attach Supabase access token so Route Handlers see the user when cookies are missing (common in WebViews / hybrid). */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}
