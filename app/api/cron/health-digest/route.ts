/**
 * GET /api/cron/health-digest
 *
 * Called once daily at 11am IST (05:30 UTC) via Vercel Cron.
 * Computes the current month's contest standings and yesterday's rank crossings,
 * then posts a quirky digest to the public Slack channel.
 *
 * Secured by CRON_SECRET header to prevent public triggering.
 *
 * Local testing: pass ?date=YYYY-MM-DD to treat that date as "yesterday"
 * (only works in development, ignored in production).
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { postToChannel, buildDigestBlocks } from '@/lib/slack';
import type { DigestData, DigestRanking, RankCrossing } from '@/lib/slack';

const CRON_SECRET = process.env.CRON_SECRET;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** First day of the month containing d, as YYYY-MM-DD */
function monthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Last day of the month containing d */
function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const now = new Date();
  const { searchParams } = new URL(request.url);

  // ?date=YYYY-MM-DD overrides "yesterday" for local testing (ignored in production)
  const testDate =
    process.env.NODE_ENV !== 'production' ? searchParams.get('date') : null;

  let yesterday: Date;
  if (testDate && /^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
    yesterday = new Date(testDate + 'T12:00:00');
  } else {
    yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
  }

  const yesterdayStr = toISODate(yesterday);
  const dayBefore = new Date(yesterday);
  dayBefore.setDate(yesterday.getDate() - 1);
  const dayBeforeStr = toISODate(dayBefore);
  const monthStartStr = monthStart(yesterday);

  const monthName = yesterday.toLocaleString('en-US', { month: 'long' });
  const lastDayOfMonth = daysInMonth(yesterday);
  const daysRemainingInMonth = lastDayOfMonth - yesterday.getDate();

  // Fetch active profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('is_active', true);

  if (profilesError || !profiles?.length) {
    console.error('[Digest] Failed to fetch profiles:', profilesError);
    return NextResponse.json({ error: profilesError?.message ?? 'No profiles' }, { status: 500 });
  }

  // Fetch all entries from month start through yesterday (covers current standings + yesterday activity)
  const { data: monthEntries, error: monthError } = await supabase
    .from('daily_entries')
    .select('user_id, date, daily_points')
    .gte('date', monthStartStr)
    .lte('date', yesterdayStr);

  if (monthError) {
    console.error('[Digest] Failed to fetch month entries:', monthError);
    return NextResponse.json({ error: monthError.message }, { status: 500 });
  }

  const allMonthEntries = monthEntries ?? [];

  // Build per-user point buckets
  const ptsMonthByUser = new Map<string, number>();   // full month up to yesterday
  const ptsYesterdayByUser = new Map<string, number>(); // yesterday only

  for (const e of allMonthEntries) {
    const pts = e.daily_points ?? 0;
    ptsMonthByUser.set(e.user_id, (ptsMonthByUser.get(e.user_id) ?? 0) + pts);
    if (e.date === yesterdayStr) {
      ptsYesterdayByUser.set(e.user_id, (ptsYesterdayByUser.get(e.user_id) ?? 0) + pts);
    }
  }

  const nobodyLogged = ptsYesterdayByUser.size === 0;

  // Current standings: month pts including yesterday
  const currentRanked = profiles.slice().sort(
    (a, b) => (ptsMonthByUser.get(b.id) ?? 0) - (ptsMonthByUser.get(a.id) ?? 0),
  );
  const currentRankMap = new Map<string, number>();
  currentRanked.forEach((p, i) => currentRankMap.set(p.id, i + 1));

  // Previous standings: month pts excluding yesterday (= current - yesterday)
  const prevRanked = profiles.slice().sort((a, b) => {
    const aPrev = (ptsMonthByUser.get(a.id) ?? 0) - (ptsYesterdayByUser.get(a.id) ?? 0);
    const bPrev = (ptsMonthByUser.get(b.id) ?? 0) - (ptsYesterdayByUser.get(b.id) ?? 0);
    return bPrev - aPrev;
  });
  const prevRankMap = new Map<string, number>();
  prevRanked.forEach((p, i) => prevRankMap.set(p.id, i + 1));

  // Build a lookup: prevRank → userId (to find who was displaced)
  const userAtPrevRank = new Map<number, string>();
  prevRanked.forEach((p, i) => userAtPrevRank.set(i + 1, p.id));

  // Compute rank crossings: for each user who improved rank yesterday,
  // identify the person who was sitting at their new rank before they overtook them.
  const rankCrossings: RankCrossing[] = [];
  if (!nobodyLogged) {
    for (const [userId] of Array.from(ptsYesterdayByUser)) {
      const cur = currentRankMap.get(userId) ?? 999;
      const prev = prevRankMap.get(userId) ?? 999;
      if (cur >= prev) continue; // no improvement

      // The person who held the climber's new rank before yesterday
      const displacedId = userAtPrevRank.get(cur);
      if (!displacedId || displacedId === userId) continue;

      const climberProfile = profiles.find((p) => p.id === userId);
      const displacedProfile = profiles.find((p) => p.id === displacedId);
      if (!climberProfile || !displacedProfile) continue;

      rankCrossings.push({
        climber: climberProfile.display_name,
        overtook: displacedProfile.display_name,
        new_rank: cur,
      });
    }
    // Sort crossings by new rank (top positions first)
    rankCrossings.sort((a, b) => a.new_rank - b.new_rank);
  }

  // Top 5 current standings
  const top5: DigestRanking[] = currentRanked.slice(0, 5).map((p, i) => ({
    rank: i + 1,
    display_name: p.display_name,
    pts: ptsMonthByUser.get(p.id) ?? 0,
  }));

  const leader = {
    display_name: currentRanked[0].display_name,
    total_pts_month: ptsMonthByUser.get(currentRanked[0].id) ?? 0,
  };

  // Yesterday's MVP: highest single-day pts
  let biggestGainer: DigestData['biggest_gainer_yesterday'] = null;
  let topYesterdayPts = 0;
  for (const [userId, pts] of Array.from(ptsYesterdayByUser)) {
    if (pts > topYesterdayPts) {
      topYesterdayPts = pts;
      const profile = profiles.find((p) => p.id === userId);
      if (profile) {
        biggestGainer = { display_name: profile.display_name, pts_yesterday: pts };
      }
    }
  }

  const teamPtsYesterday = Array.from(ptsYesterdayByUser.values()).reduce((s, v) => s + v, 0);

  const digestData: DigestData = {
    nobody_logged: nobodyLogged,
    leader,
    top5,
    biggest_gainer_yesterday: biggestGainer,
    rank_crossings: rankCrossings,
    team_pts_yesterday: teamPtsYesterday,
    logged_yesterday_count: ptsYesterdayByUser.size,
    total_users: profiles.length,
    month_name: monthName,
    days_remaining_in_month: daysRemainingInMonth,
  };

  try {
    await postToChannel(buildDigestBlocks(digestData));
  } catch (e) {
    console.error('[Digest] Failed to post to Slack:', e);
    return NextResponse.json({ error: 'Slack post failed' }, { status: 500 });
  }

  return NextResponse.json({
    posted: true,
    nobody_logged: nobodyLogged,
    leader: leader.display_name,
    rank_crossings: rankCrossings.length,
    logged_yesterday: ptsYesterdayByUser.size,
    total_users: profiles.length,
  });
}
