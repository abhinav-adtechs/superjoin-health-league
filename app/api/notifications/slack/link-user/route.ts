import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { lookupSlackUserByEmail } from '@/lib/slack';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email } = await request.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const slackUserId = await lookupSlackUserByEmail(email.trim().toLowerCase());
  if (!slackUserId) {
    return NextResponse.json(
      { error: 'No Slack user found with that email. Make sure the email matches your Slack workspace account.' },
      { status: 404 },
    );
  }

  // Store the resolved Slack user ID in both profiles and notification_preferences
  const [profileUpdate, prefUpdate] = await Promise.all([
    supabase.from('profiles').update({ slack_user_id: slackUserId }).eq('id', user.id),
    supabase
      .from('notification_preferences')
      .upsert(
        { user_id: user.id, slack_email: email.trim().toLowerCase(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      ),
  ]);

  if (profileUpdate.error) {
    return NextResponse.json({ error: profileUpdate.error.message }, { status: 500 });
  }
  if (prefUpdate.error) {
    return NextResponse.json({ error: prefUpdate.error.message }, { status: 500 });
  }

  return NextResponse.json({ slack_user_id: slackUserId });
}
