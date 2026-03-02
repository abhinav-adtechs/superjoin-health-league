import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const ALLOWED_FIELDS = [
  'slack_enabled',
  'slack_email',
  'slack_channel_post_enabled',
  'slack_dm_enabled',
  'slack_reminder_enabled',
  'slack_reminder_time',
  'email_enabled',
  'whatsapp_enabled',
  'push_enabled',
  'push_on_entry_enabled',
  'push_reminder_enabled',
  'push_reminder_time',
] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return defaults when no row exists yet
  if (!data) {
    return NextResponse.json({
      user_id: user.id,
      slack_enabled: false,
      slack_email: null,
      slack_channel_post_enabled: true,
      slack_dm_enabled: false,
      slack_reminder_enabled: false,
      slack_reminder_time: '09:00',
      email_enabled: false,
      whatsapp_enabled: false,
      push_enabled: false,
      push_on_entry_enabled: true,
      push_reminder_enabled: false,
      push_reminder_time: '09:00',
    });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const update: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(update, { onConflict: 'user_id', ignoreDuplicates: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
