import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { LeaderboardView, LeaderboardRanking } from '@/lib/types';

type ProfileRow = { id: string; display_name: string; age_bracket: string; joined_at: string };

function weekStart(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function monthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function GET(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Supabase not configured';
    return NextResponse.json({ error: msg, rankings: [] }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const view = (searchParams.get('view') ?? 'weekly') as LeaderboardView;
  if (!['weekly', 'monthly', 'alltime'].includes(view)) {
    return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
  }

  const now = new Date();
  let period = '';
  let dateFilter: { column: string; gte: string; lte?: string } | null = null;

  if (view === 'weekly') {
    const start = weekStart(now);
    const end = new Date(now);
    end.setDate(end.getDate() + (7 - end.getDay()));
    period = `${start} to ${end.toISOString().slice(0, 10)}`;
    dateFilter = { column: 'date', gte: start, lte: end.toISOString().slice(0, 10) };
  } else if (view === 'monthly') {
    const start = monthStart(now);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    period = `${start} to ${end.toISOString().slice(0, 10)}`;
    dateFilter = { column: 'date', gte: start, lte: end.toISOString().slice(0, 10) };
  } else {
    period = 'All time';
  }

  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, display_name, age_bracket, joined_at').eq('is_active', true);
  if (profilesError) {
    return NextResponse.json({
      error: profilesError.message,
      view,
      period,
      rankings: [],
      category_leaders: {},
      team_stats: {},
    }, { status: 503 });
  }
  if (!profiles?.length) {
    return NextResponse.json({
      view,
      period,
      rankings: [],
      category_leaders: {},
      team_stats: {},
    });
  }

  // Use service-role client so we can read ALL users' daily_entries (RLS otherwise only returns current user's rows)
  let entries: { user_id: string; date: string; daily_points: number }[] = [];
  try {
    const adminSupabase = createServiceRoleClient();
    if (dateFilter) {
      let q = adminSupabase.from('daily_entries').select('user_id, date, daily_points');
      q = q.gte(dateFilter.column, dateFilter.gte);
      if (dateFilter.lte) q = q.lte(dateFilter.column, dateFilter.lte);
      const { data } = await q;
      entries = (data ?? []) as typeof entries;
    } else {
      const { data } = await adminSupabase.from('daily_entries').select('user_id, date, daily_points');
      entries = (data ?? []) as typeof entries;
    }
  } catch (e) {
    return NextResponse.json({
      error: 'Cannot load leaderboard entries',
      view,
      period,
      rankings: [],
      category_leaders: {},
      team_stats: {},
    }, { status: 503 });
  }

  const pointsByUser = new Map<string, number>();
  const daysActiveByUser = new Map<string, Set<string>>();
  for (const e of entries) {
    pointsByUser.set(e.user_id, (pointsByUser.get(e.user_id) ?? 0) + (e.daily_points ?? 0));
    if (!daysActiveByUser.has(e.user_id)) daysActiveByUser.set(e.user_id, new Set());
    daysActiveByUser.get(e.user_id)!.add(e.date);
  }

  let rankings: LeaderboardRanking[];
  if (view === 'alltime') {
    rankings = profiles.map((p: ProfileRow) => {
      const total = pointsByUser.get(p.id) ?? 0;
      const daysSinceJoin = Math.max(1, Math.floor((Date.now() - new Date(p.joined_at).getTime()) / (24 * 60 * 60 * 1000)));
      const normalized = total / daysSinceJoin;
      return {
        rank: 0,
        user: { display_name: p.display_name, streak_days: 0, days_active: daysActiveByUser.get(p.id)?.size ?? 0 },
        score: { total_points: total, normalized_score: Math.round(normalized * 10) / 10 },
      };
    });
    rankings.sort((a, b) => b.score.normalized_score - a.score.normalized_score);
  } else {
    rankings = profiles.map((p: ProfileRow) => ({
      rank: 0,
      user: { display_name: p.display_name, streak_days: 0, days_active: daysActiveByUser.get(p.id)?.size ?? 0 },
      score: { total_points: pointsByUser.get(p.id) ?? 0, normalized_score: pointsByUser.get(p.id) ?? 0 },
    }));
    rankings.sort((a, b) => b.score.total_points - a.score.total_points);
  }

  rankings.forEach((r, i) => { r.rank = i + 1; });

  return NextResponse.json({
    view,
    period,
    rankings,
    category_leaders: {},
    team_stats: {},
  });
}
