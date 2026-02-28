/**
 * GET /api/integrations/status
 * Returns the connection status for all integration platforms for the current user.
 *
 * Also handles:
 * PATCH /api/integrations/status  → generic preference update for any platform
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { IntegrationPlatform, IntegrationStatus, SyncPreference } from '@/lib/types';

const ALL_PLATFORMS: IntegrationPlatform[] = ['fitbit', 'apple_health', 'google_health'];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: accounts } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('user_id', user.id);

  interface AccountRow {
    platform: string;
    sync_enabled: boolean | null;
    sync_preference: string | null;
    connected_at: string | null;
    last_synced_at: string | null;
    platform_user_id: string | null;
  }

  const accountMap = new Map<string, AccountRow>(
    (accounts ?? []).map((a: AccountRow) => [a.platform, a]),
  );

  const statuses: IntegrationStatus[] = ALL_PLATFORMS.map((platform) => {
    const account = accountMap.get(platform);
    if (!account) {
      return {
        platform,
        connected: false,
        sync_enabled: false,
        sync_preference: 'fill_nulls' as SyncPreference,
        connected_at: null,
        last_synced_at: null,
        platform_user_id: null,
      };
    }
    return {
      platform,
      connected: true,
      sync_enabled: account.sync_enabled ?? true,
      sync_preference: (account.sync_preference as SyncPreference) ?? 'fill_nulls',
      connected_at: account.connected_at,
      last_synced_at: account.last_synced_at,
      platform_user_id: account.platform_user_id,
    };
  });

  return NextResponse.json({ statuses });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { platform, sync_enabled, sync_preference } = body;

  if (!ALL_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof sync_enabled === 'boolean') updates.sync_enabled = sync_enabled;
  if (sync_preference === 'fill_nulls' || sync_preference === 'always_override') {
    updates.sync_preference = sync_preference;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const { error } = await supabase
    .from('connected_accounts')
    .update(updates)
    .eq('user_id', user.id)
    .eq('platform', platform);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
