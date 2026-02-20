import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Verifies Supabase env and connectivity. When authenticated, returns profile count
 * so you can confirm the DB is connected and has users.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({
      ok: false,
      supabaseConfigured: false,
      message: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local',
    }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        ok: true,
        supabaseConfigured: true,
        authenticated: false,
        message: 'Supabase is configured. Sign in to see profile count.',
      });
    }

    const { count: totalCount, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({
        ok: false,
        supabaseConfigured: true,
        authenticated: true,
        error: error.message,
        message: 'Connected to Supabase but query failed. Check RLS and schema.',
      }, { status: 503 });
    }

    const { count: activeCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    return NextResponse.json({
      ok: true,
      supabaseConfigured: true,
      authenticated: true,
      profilesTotal: totalCount ?? 0,
      profilesActive: activeCount ?? 0,
      message: (activeCount ?? 0) === 0
        ? 'DB connected. No active profiles (leaderboard shows is_active = true only). Add users or check schema.'
        : `DB connected. ${activeCount} active profile(s).`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({
      ok: false,
      supabaseConfigured: true,
      error: message,
      message: 'Supabase client failed. Check URL, anon key, and network.',
    }, { status: 503 });
  }
}
