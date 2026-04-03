import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getBearerAccessToken } from '@/lib/supabase/bearer-auth';

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_HEALTH_LEAGUE_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_HEALTH_LEAGUE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_* or NEXT_PUBLIC_HEALTH_LEAGUE_SUPABASE_*)');
  }
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore in Server Components
        }
      },
    },
  });
}

/**
 * Resolve the signed-in user for Route Handlers (cookie session or Bearer).
 * Important: `getUser(jwt)` does NOT fall back to cookies if the JWT is expired or invalid.
 * Clients often send a stale Bearer from `getSession()` while `sb-*` cookies are still valid.
 */
export async function getSupabaseWithUser(request: Request) {
  const supabase = await createClient();
  const jwt = getBearerAccessToken(request);
  if (jwt) {
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (user) return { supabase, user };
  }
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}
