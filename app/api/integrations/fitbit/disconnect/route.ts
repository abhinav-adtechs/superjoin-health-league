/**
 * DELETE /api/integrations/fitbit/disconnect
 * Revokes the Fitbit access token and removes the connected account row.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { revokeFitbitToken } from '@/lib/integrations/fitbit';

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: account } = await supabase
    .from('connected_accounts')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('platform', 'fitbit')
    .maybeSingle();

  if (account?.access_token) {
    const clientId = process.env.FITBIT_CLIENT_ID!;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET!;
    // Best-effort revocation; do not block if it fails
    revokeFitbitToken({ token: account.access_token, clientId, clientSecret }).catch(() => {});
  }

  await supabase
    .from('connected_accounts')
    .delete()
    .eq('user_id', user.id)
    .eq('platform', 'fitbit');

  return NextResponse.json({ ok: true });
}

/** Also allow PATCH to update sync preferences */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (typeof body.sync_enabled === 'boolean') updates.sync_enabled = body.sync_enabled;
  if (body.sync_preference === 'fill_nulls' || body.sync_preference === 'always_override') {
    updates.sync_preference = body.sync_preference;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('connected_accounts')
    .update(updates)
    .eq('user_id', user.id)
    .eq('platform', 'fitbit');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
