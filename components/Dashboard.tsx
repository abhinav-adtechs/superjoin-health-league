import React, { useMemo, useState } from 'react';
import { Player, Match } from '../types';
import type { StandingsView } from '../types';
import { getNormalisedScoreFromStats } from '../utils/standings';
import { computeLeagueStats } from '../utils/leagueStats';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Activity, Award, Target, BarChart3, Calculator, Trophy, LayoutList, Globe, User, Minus } from 'lucide-react';

const TRAJECTORY_VIEWS: { id: StandingsView; label: string; icon: typeof Trophy }[] = [
  { id: 'NORMALISED', label: 'Normalised', icon: Calculator },
  { id: 'PPG', label: 'PPG', icon: LayoutList },
  { id: 'TABLE', label: 'Table', icon: Trophy },
];

interface DashboardProps {
  players: Player[];
  matches: Match[];
}

export const Dashboard: React.FC<DashboardProps> = ({ players, matches }) => {
  const [trajectoryView, setTrajectoryView] = useState<StandingsView>('NORMALISED');
  const colors = ['#059669', '#2563eb', '#ea580c', '#d97706', '#7c3aed', '#dc2626'];

  const sortedMatches = [...matches].sort((a, b) => a.timestamp - b.timestamp);

  // Build cumulative stats after each match: points, played, gd per player
  const trajectoryData = useMemo(() => {
    const history: { match: number | string; [playerName: string]: number | string }[] = [];
    const pts: Record<string, number> = {};
    const played: Record<string, number> = {};
    const gd: Record<string, number> = {};
    players.forEach(p => {
      pts[p.name] = 0;
      played[p.name] = 0;
      gd[p.name] = 0;
    });
    history.push({
      match: 'Start',
      ...Object.fromEntries(players.map(p => [p.name, 0])),
    });

    sortedMatches.forEach((m, idx) => {
      const p1 = players.find(p => p.id === m.player1Id);
      const p2 = players.find(p => p.id === m.player2Id);
      if (p1 && p2) {
        const p1Pts = m.score1 > m.score2 ? 3 : m.score1 === m.score2 ? 1 : 0;
        const p2Pts = m.score2 > m.score1 ? 3 : m.score2 === m.score1 ? 1 : 0;
        pts[p1.name] = (pts[p1.name] || 0) + p1Pts;
        pts[p2.name] = (pts[p2.name] || 0) + p2Pts;
        played[p1.name] = (played[p1.name] || 0) + 1;
        played[p2.name] = (played[p2.name] || 0) + 1;
        const p1GD = m.score1 - m.score2;
        const p2GD = m.score2 - m.score1;
        gd[p1.name] = (gd[p1.name] || 0) + p1GD;
        gd[p2.name] = (gd[p2.name] || 0) + p2GD;
      }
      const row: { match: number | string; [k: string]: number | string } = { match: idx + 1 };
      players.forEach(p => {
        const pointVal = pts[p.name] ?? 0;
        const playedVal = played[p.name] ?? 0;
        const gdVal = gd[p.name] ?? 0;
        if (trajectoryView === 'TABLE') {
          row[p.name] = pointVal;
        } else if (trajectoryView === 'PPG') {
          row[p.name] = playedVal > 0 ? Math.round((pointVal / playedVal) * 100) / 100 : 0;
        } else {
          row[p.name] = Math.round(getNormalisedScoreFromStats(playedVal, pointVal, gdVal) * 100) / 100;
        }
      });
      history.push(row);
    });
    return history;
  }, [players, sortedMatches, trajectoryView]);

  const leagueStats = useMemo(() => computeLeagueStats(matches), [matches]);
  const topScorer = [...players].sort((a, b) => b.gf - a.gf)[0];
  const bestDefender = [...players].sort((a, b) => {
    const gaPerGameA = a.played > 0 ? a.ga / a.played : Infinity;
    const gaPerGameB = b.played > 0 ? b.ga / b.played : Infinity;
    return gaPerGameA - gaPerGameB;
  })[0];

  const leagueStatsCards = [
    {
      label: 'Total Matches',
      value: leagueStats.totalMatches,
      icon: Activity,
      color: 'text-accent-green',
      bgColor: 'bg-accent-green/10',
      borderColor: 'border-accent-green/15',
    },
    {
      label: 'Total Goals',
      value: leagueStats.totalGoals,
      icon: TrendingUp,
      color: 'text-accent-gold',
      bgColor: 'bg-accent-gold/10',
      borderColor: 'border-accent-gold/15',
    },
    {
      label: 'Avg Goals / Match',
      value: leagueStats.totalMatches ? leagueStats.avgGoalsPerMatch.toFixed(1) : '0',
      icon: BarChart3,
      color: 'text-accent-blue',
      bgColor: 'bg-accent-blue/10',
      borderColor: 'border-accent-blue/15',
    },
    {
      label: 'Draws',
      value: leagueStats.totalDraws,
      subtitle: leagueStats.totalMatches
        ? `${((leagueStats.totalDraws / leagueStats.totalMatches) * 100).toFixed(0)}% of matches`
        : undefined,
      icon: Minus,
      color: 'text-text-secondary',
      bgColor: 'bg-glass-strong',
      borderColor: 'border-glass-border',
    },
  ];

  const playerStatsCards = [
    {
      label: 'Golden Boot',
      value: topScorer?.name || '—',
      subtitle: topScorer ? `${topScorer.gf} Goals` : undefined,
      icon: Award,
      color: 'text-accent-orange',
      bgColor: 'bg-accent-orange/10',
      borderColor: 'border-accent-orange/15',
    },
    {
      label: 'Best Defense',
      value: bestDefender?.name || '—',
      subtitle: bestDefender && bestDefender.played > 0 ? `${(bestDefender.ga / bestDefender.played).toFixed(1)} GA/G` : undefined,
      icon: Target,
      color: 'text-accent-blue',
      bgColor: 'bg-accent-blue/10',
      borderColor: 'border-accent-blue/15',
    },
  ];

  return (
    <div className="space-y-8">
      {/* League-level stats (aggregate over all matches) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-text-muted">
          <Globe className="w-4 h-4" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">League stats</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {leagueStatsCards.map((stat, i) => (
            <div key={i} className="stat-card group">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg ${stat.bgColor} border ${stat.borderColor} flex items-center justify-center`}>
                  <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-extrabold ${stat.color} font-mono tracking-tight truncate`}>
                {stat.value}
              </div>
              {stat.subtitle && (
                <div className="text-[10px] font-medium text-text-muted mt-0.5">{stat.subtitle}</div>
              )}
              <div className="text-[10px] sm:text-[11px] font-medium text-text-muted mt-1 uppercase tracking-wider">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Player-level stats (individual awards / per-player) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-text-muted">
          <User className="w-4 h-4" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Player stats</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {playerStatsCards.map((stat, i) => (
            <div key={i} className="stat-card group">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg ${stat.bgColor} border ${stat.borderColor} flex items-center justify-center`}>
                  <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-extrabold ${stat.color} font-mono tracking-tight truncate`}>
                {stat.value}
              </div>
              {stat.subtitle && (
                <div className="text-[10px] font-medium text-text-muted mt-0.5">{stat.subtitle}</div>
              )}
              <div className="text-[10px] sm:text-[11px] font-medium text-text-muted mt-1 uppercase tracking-wider">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Season Trajectory with 3 formula tabs */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <BarChart3 className="w-4 h-4 text-text-muted" />
            <h3 className="text-sm font-semibold text-text-primary">Season Trajectory</h3>
            <span className="text-[10px] font-mono text-text-muted ml-auto">
              {trajectoryView === 'TABLE' ? 'Points over time' : trajectoryView === 'PPG' ? 'PPG over time' : 'Normalised score over time'}
            </span>
          </div>
          <div className="flex justify-start">
            <div className="glass-card p-1 inline-flex gap-1">
              {TRAJECTORY_VIEWS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTrajectoryView(id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    trajectoryView === id
                      ? id === 'TABLE'
                        ? 'bg-accent-green/15 text-accent-green border border-accent-green/20'
                        : 'bg-accent-gold/15 text-accent-gold border border-accent-gold/20'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-[260px] sm:h-[320px] w-full">
          {matches.length < 2 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm font-medium">Not enough data yet</p>
              <p className="text-xs mt-1">Play more matches to see trends.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis
                  dataKey="match"
                  stroke="rgba(0,0,0,0.12)"
                  tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: 'rgba(0,0,0,0.06)' }}
                />
                <YAxis
                  stroke="rgba(0,0,0,0.12)"
                  tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: 'rgba(0,0,0,0.06)' }}
                  tickFormatter={trajectoryView !== 'TABLE' ? (v) => Number(v).toFixed(2) : undefined}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '3px',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 20px 40px -12px rgba(0,0,0,0.15)',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                  itemStyle={{ color: '#0f172a', fontSize: '11px' }}
                  labelStyle={{ color: '#64748b', fontSize: '10px', fontWeight: 600 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', fontFamily: 'Inter' }}
                  iconType="circle"
                  iconSize={8}
                />
                {players.map((p, i) => (
                  <Line
                    key={p.id}
                    type="monotone"
                    dataKey={p.name}
                    stroke={colors[i % colors.length]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 5,
                      stroke: colors[i % colors.length],
                      strokeWidth: 2,
                      fill: '#ffffff',
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
