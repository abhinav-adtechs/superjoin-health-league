import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token, platform } = await request.json();
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }
  if (!['ios', 'android'].includes(platform)) {
    return NextResponse.json({ error: 'platform must be ios or android' }, { status: 400 });
  }

  // Upsert by token (unique constraint) — update user_id/platform if token reused
  const { error } = await supabase
    .from('device_tokens')
    .upsert({ user_id: user.id, token, platform }, { onConflict: 'token' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('token', token);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
