/**
 * GET /api/integrations/fitbit/connect
 * Initiates Fitbit OAuth 2.0 PKCE flow.
 * Generates code_verifier, stores it in an httpOnly cookie, and redirects to Fitbit.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { buildFitbitAuthUrl, generateCodeVerifier } from '@/lib/integrations/fitbit';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.FITBIT_CLIENT_ID;
  const redirectUri = process.env.FITBIT_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Fitbit integration not configured' }, { status: 500 });
  }

  const codeVerifier = generateCodeVerifier();
  // Use user ID as state to verify on callback
  const state = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString('base64url');

  const authUrl = await buildFitbitAuthUrl({ clientId, redirectUri, state, codeVerifier });

  // Store verifier + state in a short-lived httpOnly cookie (10 min TTL)
  const cookieStore = await cookies();
  cookieStore.set('fitbit_pkce_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  cookieStore.set('fitbit_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return NextResponse.redirect(authUrl);
}
