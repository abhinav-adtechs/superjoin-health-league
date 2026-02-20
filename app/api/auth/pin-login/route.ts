import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

const PIN_LEN = 6;
const PIN_EXPIRY_DAYS = 60;

function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profileId = body.profileId as string | undefined;
    const pin = body.pin as string | undefined;

    if (!profileId || pin === undefined) {
      return NextResponse.json({ error: 'profileId and pin required' }, { status: 400 });
    }
    if (!isValidPin(String(pin))) {
      return NextResponse.json({ error: 'PIN must be 6 digits' }, { status: 400 });
    }

    const adminSupabase = await createAdminClient();

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, pin_hash, pin_set_at, must_change_pin')
      .eq('id', profileId)
      .single();

    if (profileError || !profile?.pin_hash) {
      return NextResponse.json({ error: 'Invalid user or PIN not set' }, { status: 401 });
    }

    const match = await bcrypt.compare(String(pin), profile.pin_hash);
    if (!match) {
      return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 });
    }

    const pinSetAt = profile.pin_set_at ? new Date(profile.pin_set_at).getTime() : 0;
    const expiryMs = PIN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const pinExpired = Date.now() - pinSetAt > expiryMs;
    const mustChangePin = Boolean(profile.must_change_pin) || pinExpired;

    if (pinExpired) {
      await adminSupabase
        .from('profiles')
        .update({ must_change_pin: true })
        .eq('id', profileId);
    }

    const { data: authRow, error: authError } = await adminSupabase
      .from('profile_auth')
      .select('auth_email, auth_password')
      .eq('profile_id', profileId)
      .single();

    if (authError || !authRow) {
      return NextResponse.json({ error: 'Auth setup missing for this user' }, { status: 500 });
    }

    // Use regular client (not admin) for sign-in so cookies are set properly
    const supabase = await createClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: authRow.auth_email,
      password: authRow.auth_password,
    });

    if (signInError || !signInData.session) {
      return NextResponse.json({ error: signInError?.message || 'Could not start session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      mustChangePin,
      pinExpired,
    });
  } catch (e) {
    console.error('Pin login error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
