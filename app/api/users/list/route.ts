import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** Returns minimal profile list for login dropdown (id, display_name, avatar_url). Uses service role. Includes admin if they have a PIN. */
export async function GET() {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('is_active', true)
      .not('pin_hash', 'is', null)
      .order('display_name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ users: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
