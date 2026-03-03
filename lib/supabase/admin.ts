import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_HEALTH_LEAGUE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.HEALTH_LEAGUE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.HEALTH_LEAGUE_SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server Supabase client with SERVICE ROLE key — bypasses RLS.
 * Use for: leaderboard (read all entries), pin-login, users list, set-pin.
 * Uses createClient from supabase-js (no cookies) so the service role is not overridden by session.
 * Never expose this client or key to the browser.
 */
export function createServiceRoleClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY (or HEALTH_LEAGUE_SUPABASE_SERVICE_ROLE_KEY)');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Legacy admin client (SSR + cookies). Prefer createServiceRoleClient() for RLS bypass.
 * Use only when you need to perform actions that then set cookies (e.g. sign-in).
 */
export async function createAdminClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_HEALTH_LEAGUE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.HEALTH_LEAGUE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.HEALTH_LEAGUE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase URL or service role key');
  }
  return createServerClient(url, key, {
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
