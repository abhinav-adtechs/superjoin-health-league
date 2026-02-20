import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const newPin = body.newPin as string | undefined;
    if (!newPin || !isValidPin(String(newPin))) {
      return NextResponse.json({ error: 'New PIN must be 6 digits' }, { status: 400 });
    }

    const admin = await createAdminClient();
    const { data: profile, error: fetchError } = await admin
      .from('profiles')
      .select('id, pin_hash, previous_pin_hash')
      .eq('id', user.id)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const newHash = await bcrypt.hash(String(newPin), 10);
    if (profile.previous_pin_hash) {
      const sameAsPrevious = await bcrypt.compare(String(newPin), profile.previous_pin_hash);
      if (sameAsPrevious) {
        return NextResponse.json({ error: 'New PIN cannot be the same as your last PIN' }, { status: 400 });
      }
    }
    if (profile.pin_hash) {
      const sameAsCurrent = await bcrypt.compare(String(newPin), profile.pin_hash);
      if (sameAsCurrent) {
        return NextResponse.json({ error: 'New PIN cannot be the same as your current PIN' }, { status: 400 });
      }
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        previous_pin_hash: profile.pin_hash,
        pin_hash: newHash,
        pin_set_at: new Date().toISOString(),
        must_change_pin: false,
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
