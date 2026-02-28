/**
 * GET /api/integrations/fitbit/callback
 * Handles the OAuth 2.0 callback from Fitbit.
 * Exchanges the authorization code for tokens, stores them, and triggers an initial sync.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/integrations/fitbit';
import { cookies } from 'next/headers';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // User denied permission on Fitbit side
  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/?tab=connected&error=fitbit_denied`);
  }

  const cookieStore = await cookies();
  const storedVerifier = cookieStore.get('fitbit_pkce_verifier')?.value;
  const storedState = cookieStore.get('fitbit_oauth_state')?.value;

  if (!storedVerifier || !storedState || storedState !== state) {
    return NextResponse.redirect(`${APP_URL}/?tab=connected&error=fitbit_state_mismatch`);
  }

  // Clear PKCE cookies
  cookieStore.delete('fitbit_pkce_verifier');
  cookieStore.delete('fitbit_oauth_state');

  const clientId = process.env.FITBIT_CLIENT_ID!;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET!;
  const redirectUri = process.env.FITBIT_REDIRECT_URI!;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(`${APP_URL}/?tab=connected&error=fitbit_config`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/?tab=connected&error=unauthorized`);
  }

  let tokens;
  try {
    tokens = await exchangeCodeForToken({
      code,
      codeVerifier: storedVerifier,
      clientId,
      clientSecret,
      redirectUri,
    });
  } catch {
    return NextResponse.redirect(`${APP_URL}/?tab=connected&error=fitbit_token_exchange`);
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Upsert the connected account row
  const { error: dbError } = await supabase
    .from('connected_accounts')
    .upsert(
      {
        user_id: user.id,
        platform: 'fitbit',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        scopes: tokens.scope.split(' '),
        platform_user_id: tokens.user_id,
        connected_at: new Date().toISOString(),
        sync_enabled: true,
        sync_preference: 'fill_nulls',
      },
      { onConflict: 'user_id,platform' },
    );

  if (dbError) {
    return NextResponse.redirect(`${APP_URL}/?tab=connected&error=fitbit_db`);
  }

  // Trigger initial sync for today (best-effort, do not block redirect)
  const today = new Date().toISOString().slice(0, 10);
  const syncUrl = `${APP_URL}/api/integrations/fitbit/sync`;
  fetch(syncUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') ?? '' },
    body: JSON.stringify({ date: today }),
  }).catch(() => {});

  return NextResponse.redirect(`${APP_URL}/?tab=connected&success=fitbit`);
}
