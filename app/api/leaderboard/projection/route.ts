import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

type ProfileRow = { id: string; display_name: string; joined_at: string };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let adminSupabase;
  try {
    adminSupabase = createServiceRoleClient();
  } catch (e) {
    return NextResponse.json({ error: 'Server not configured for leaderboard' }, { status: 503 });
  }

  const { data: profiles, error: profilesError } = await adminSupabase
    .from('profiles')
    .select('id, display_name, joined_at')
    .eq('is_active', true);

  if (profilesError || !profiles?.length) {
    return NextResponse.json({
      rank: 0,
      is_first: false,
      leader_normalized_score: 0,
      user_total_points: 0,
      user_days_since_joining: 0,
      user_normalized_score: 0,
      expected_daily_points: 70,
      days_to_first: null,
      message: 'No leaderboard data',
    });
  }

  const { data: allEntries } = await adminSupabase
    .from('daily_entries')
    .select('user_id, date, daily_points');

  const entries = (allEntries ?? []) as { user_id: string; date: string; daily_points: number }[];
  const pointsByUser = new Map<string, number>();
  for (const e of entries) {
    pointsByUser.set(e.user_id, (pointsByUser.get(e.user_id) ?? 0) + (e.daily_points ?? 0));
  }

  const rankings = (profiles as ProfileRow[]).map((p) => {
    const total = pointsByUser.get(p.id) ?? 0;
    const daysSinceJoin = Math.max(1, Math.floor((Date.now() - new Date(p.joined_at).getTime()) / (24 * 60 * 60 * 1000)));
    const normalized = total / daysSinceJoin;
    return { id: p.id, display_name: p.display_name, total, daysSinceJoin, normalized };
  });
  rankings.sort((a, b) => b.normalized - a.normalized);

  const userRanking = rankings.find((r) => r.id === user.id);
  const leader = rankings[0];
  if (!userRanking || !leader) {
    return NextResponse.json({
      rank: 0,
      is_first: false,
      leader_normalized_score: leader?.normalized ?? 0,
      user_total_points: 0,
      user_days_since_joining: 0,
      user_normalized_score: 0,
      expected_daily_points: 70,
      days_to_first: null,
      message: 'User or leader not found',
    });
  }

  const rank = rankings.indexOf(userRanking) + 1;
  const isFirst = rank === 1;

  // Expected daily points: average from user's last 30 days, or 70
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const from = thirtyDaysAgo.toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const { data: userEntries } = await supabase
    .from('daily_entries')
    .select('daily_points')
    .eq('user_id', user.id)
    .gte('date', from)
    .lte('date', to);

  const recentPoints = (userEntries ?? []) as { daily_points: number }[];
  const avgPoints = recentPoints.length > 0
    ? recentPoints.reduce((s, e) => s + (e.daily_points ?? 0), 0) / recentPoints.length
    : 70;
  const expectedDailyPoints = Math.round(avgPoints * 10) / 10;

  // Days until user's normalized score >= leader's if user scores P every day: (T + n*P) / (D+n) >= L => n >= (L*D - T) / (P - L)
  const T = userRanking.total;
  const D = userRanking.daysSinceJoin;
  const L = leader.normalized;
  const P = expectedDailyPoints;
  let daysToFirst: number | null = null;
  if (!isFirst && P > L && L * D - T > 0) {
    const n = (L * D - T) / (P - L);
    daysToFirst = Math.ceil(n);
    if (daysToFirst > 365) daysToFirst = 365; // Cap display
  }

  return NextResponse.json({
    rank,
    is_first: isFirst,
    leader_normalized_score: Math.round(L * 10) / 10,
    user_total_points: T,
    user_days_since_joining: D,
    user_normalized_score: Math.round(userRanking.normalized * 10) / 10,
    expected_daily_points: expectedDailyPoints,
    days_to_first: daysToFirst,
  });
}
