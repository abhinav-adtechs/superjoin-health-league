/**
 * GET /api/cron/daily-reminders
 *
 * Called by Vercel Cron every 5 minutes (see vercel.json).
 * Finds users whose daily reminder time matches the current UTC time (within ±2 min window),
 * then sends a Slack DM and/or push notification reminder.
 *
 * Secured by CRON_SECRET header to prevent public triggering.
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { sendDM, buildReminderBlocks } from '@/lib/slack';
import { sendPushToUser } from '@/lib/push';

const CRON_SECRET = process.env.CRON_SECRET;

/** Convert HH:MM local time + IANA timezone → UTC HH:MM string, or null on error. */
function localToUtcHHMM(localHHMM: string, timezone: string): string | null {
  try {
    const [hh, mm] = localHHMM.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;

    // Build a reference date with the given local time in the user's timezone
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
    const localISO = `${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;

    // Parse that local ISO in the target timezone → get UTC
    const localDate = new Date(
      new Date(localISO).toLocaleString('en-US', { timeZone: timezone }),
    );
    const utcHH = localDate.getUTCHours();
    const utcMM = localDate.getUTCMinutes();
    return `${String(utcHH).padStart(2, '0')}:${String(utcMM).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

/** True if the user's local reminder time falls within the current 5-min cron window. */
function isTimeInCurrentWindow(reminderHHMM: string, timezone: string): boolean {
  const utcTarget = localToUtcHHMM(reminderHHMM, timezone);
  if (!utcTarget) return false;

  const now = new Date();
  const nowUTC = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

  const [th, tm] = utcTarget.split(':').map(Number);
  const [nh, nm] = nowUTC.split(':').map(Number);
  const targetMin = th * 60 + tm;
  const nowMin = nh * 60 + nm;

  // Fire if within a ±2 min window to handle slight scheduling jitter
  return Math.abs(targetMin - nowMin) <= 2;
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // Fetch all users with at least one reminder enabled, joined with their profile timezone and slack_user_id
  const { data: prefs, error } = await supabase
    .from('notification_preferences')
    .select(`
      user_id,
      slack_enabled,
      slack_dm_enabled,
      slack_reminder_enabled,
      slack_reminder_time,
      push_enabled,
      push_reminder_enabled,
      push_reminder_time,
      profiles!inner (
        display_name,
        timezone,
        slack_user_id
      )
    `)
    .or('slack_reminder_enabled.eq.true,push_reminder_enabled.eq.true');

  if (error) {
    console.error('[Cron] Failed to fetch notification_preferences:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!prefs || prefs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let slackSent = 0;
  let pushSent = 0;

  await Promise.all(
    prefs.map(async (pref) => {
      const profile = Array.isArray(pref.profiles) ? pref.profiles[0] : pref.profiles;
      const timezone: string = (profile as { timezone?: string })?.timezone || 'UTC';
      const displayName: string = (profile as { display_name?: string })?.display_name || 'there';
      const slackUserId: string | null = (profile as { slack_user_id?: string | null })?.slack_user_id ?? null;

      // Slack DM reminder
      if (
        pref.slack_enabled &&
        pref.slack_dm_enabled &&
        pref.slack_reminder_enabled &&
        pref.slack_reminder_time &&
        slackUserId &&
        isTimeInCurrentWindow(pref.slack_reminder_time, timezone)
      ) {
        await sendDM(
          slackUserId,
          `Hey ${displayName}! Don't forget to log your health activities today! 🌟`,
          buildReminderBlocks(displayName),
        );
        slackSent++;
      }

      // Push reminder
      if (
        pref.push_enabled &&
        pref.push_reminder_enabled &&
        pref.push_reminder_time &&
        isTimeInCurrentWindow(pref.push_reminder_time, timezone)
      ) {
        const { data: tokens } = await supabase
          .from('device_tokens')
          .select('token')
          .eq('user_id', pref.user_id);

        if (tokens && tokens.length > 0) {
          const { sent } = await sendPushToUser(
            tokens.map((t: { token: string }) => t.token),
            {
              title: '⏰ Daily Health Reminder',
              body: `Hey ${displayName}! Log your health activities and climb the leaderboard today 🏆`,
              data: { type: 'daily_reminder' },
            },
          );
          pushSent += sent;
        }
      }
    }),
  );

  return NextResponse.json({ slack_sent: slackSent, push_sent: pushSent });
}
