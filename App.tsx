import React, { useState, useEffect } from 'react';
import { Player, Match, Tab } from './types';
import type { StandingsView } from './types';
import { Standings } from './components/Standings';
import { getLeader, getNormalisedScoreDisplay, computePlayersWithStats } from './utils/standings';
import { MatchList } from './components/MatchList';
import { PlayerManager } from './components/PlayerManager';
import { MatchForm } from './components/MatchForm';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { LoginDetails } from './components/LoginDetails';
import { db } from './services/storage';
import { auth, Admin } from './services/auth';
import { Trophy, Users, History, PlusCircle, LayoutDashboard, Lock, Heart, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.STANDINGS);
  const [standingsView, setStandingsView] = useState<StandingsView>('NORMALISED');
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);

  const getPlayerAvatar = (name: string): string => {
    const nameLower = name.toLowerCase().trim();
    const avatarMap: Record<string, string> = {
      'abhinav': 'https://img.a.transfermarkt.technology/portrait/header/433179-1672832000.jpg?lm=1',
      'karan': 'https://img.a.transfermarkt.technology/portrait/header/342229-1672832000.jpg?lm=1',
      'manan': 'https://img.a.transfermarkt.technology/portrait/header/38253-1672832000.jpg?lm=1',
      'sagar': 'https://img.a.transfermarkt.technology/portrait/header/418560-1672832000.jpg?lm=1',
      'ayush': 'https://img.a.transfermarkt.technology/portrait/header/636999-1672832000.jpg?lm=1'
    };
    if (avatarMap[nameLower]) return avatarMap[nameLower];
    for (const [key, value] of Object.entries(avatarMap)) {
      if (nameLower.includes(key) || key.includes(nameLower)) return value;
    }
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}&backgroundColor=fae100,6b46c1,1a1625`;
  };

  useEffect(() => {
    const loadData = async () => {
      const [loadedPlayers, loadedMatches] = await Promise.all([
        db.getPlayers(),
        db.getMatches()
      ]);
      const updatedPlayers = loadedPlayers.map(player => ({
        ...player,
        avatarUrl: getPlayerAvatar(player.name)
      }));
      const avatarsChanged = updatedPlayers.some((p, i) => p.avatarUrl !== loadedPlayers[i]?.avatarUrl);
      if (avatarsChanged && updatedPlayers.length > 0) {
        db.savePlayers(updatedPlayers).catch(console.error);
      }
      setPlayers(updatedPlayers);
      setMatches(loadedMatches);
    };
    loadData();
    if (auth.isAuthenticated()) {
      setCurrentAdmin(auth.getCurrentAdmin());
    }
  }, []);

  const handleAddPlayer = (name: string) => {
    if (!currentAdmin) {
      alert('Admin access required. Please login first.');
      setActiveTab(Tab.LOGIN);
      return;
    }
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name,
      avatarUrl: getPlayerAvatar(name),
      played: 0, wins: 0, draws: 0, losses: 0,
      gf: 0, ga: 0, gd: 0, points: 0, ppg: 0, form: []
    };
    const updated = [...players, newPlayer];
    setPlayers(updated);
    db.savePlayers(updated).catch(console.error);
  };

  const handleDeletePlayer = (id: string) => {
    if (!currentAdmin) {
      alert('Admin access required. Please login first.');
      setActiveTab(Tab.LOGIN);
      return;
    }
    const updated = players.filter(p => p.id !== id);
    setPlayers(updated);
    db.savePlayers(updated).catch(console.error);
  };

  const handleAddMatch = async (p1Id: string, p2Id: string, s1: number, s2: number) => {
    if (!currentAdmin) {
      alert('Admin access required. Please login first.');
      setShowMatchForm(false);
      setActiveTab(Tab.LOGIN);
      return;
    }
    const newMatch: Match = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      player1Id: p1Id,
      player2Id: p2Id,
      score1: s1,
      score2: s2
    };
    const updatedMatches = [newMatch, ...matches];
    setMatches(updatedMatches);
    db.saveMatches(updatedMatches).catch(console.error);
    setShowMatchForm(false);
    setActiveTab(Tab.MATCHES);
  };

  const tabs = [
    { id: Tab.STANDINGS, label: 'Table', icon: Trophy },
    { id: Tab.MATCHES, label: 'Matches', icon: History },
    { id: Tab.DASHBOARD, label: 'Stats', icon: LayoutDashboard },
    { id: Tab.PLAYERS, label: 'Squad', icon: Users },
    { id: Tab.LOGIN, label: 'Admin', icon: Lock },
  ];

  // Top player for the hero section — follows active standings view (Norm / PPG / Table)
  // Always derive live stats from raw matches instead of relying on stored stats
  const playersWithStats = computePlayersWithStats(players, matches);

  const topPlayer = getLeader(playersWithStats, standingsView);

  return (
    <div className="relative z-10 min-h-screen">
      {/* ===== TOP NAVIGATION BAR ===== */}
      <header className="sticky top-0 z-50">
        <div className="absolute inset-0 bg-surface-0/80 backdrop-blur-xl border-b border-glass-border"></div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <div className="h-14 sm:h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
                <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-accent-green/20 to-accent-gold/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-glass-medium border border-glass-border flex items-center justify-center overflow-hidden">
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-accent-green" />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-bold text-text-primary tracking-tight">OFFICE</span>
                <span className="text-sm sm:text-base font-bold gradient-text-static tracking-tight">HEALTH</span>
              </div>
              <span className="hidden sm:inline-flex items-center text-[10px] font-mono font-medium text-text-muted bg-glass-light border border-glass-border rounded-md px-1.5 py-0.5">
                Wellness
              </span>
            </div>

            {/* Record Result Button */}
            <button
              onClick={() => {
                if (!currentAdmin) {
                  alert('Admin access required. Please login first.');
                  setActiveTab(Tab.LOGIN);
                  return;
                }
                setShowMatchForm(true);
              }}
              disabled={players.length < 2 || !currentAdmin}
              className="btn-primary flex items-center gap-2 text-xs sm:text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Log Activity</span>
              <span className="sm:hidden">Log</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-surface-0 via-surface-1/50 to-surface-0"></div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="animate-fade-up">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-accent-green animate-glow-pulse"></div>
                <span className="text-[11px] font-mono font-medium text-accent-green uppercase tracking-widest">Wellness</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary leading-[1.1]">
                Superjoin<br />
                <span className="gradient-text">Health OS</span>
              </h1>
              <p className="mt-3 text-sm text-text-secondary max-w-md leading-relaxed">
                Track activity, wellness, and leaderboard for your office. 
                {matches.length > 0 && ` ${matches.length} entries so far.`}
              </p>
            </div>

            {/* Leader Card */}
            {topPlayer && (
              <div className="animate-stagger-2 glass-card gradient-border p-4 sm:p-5 min-w-[200px]">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-3.5 h-3.5 text-accent-gold" />
                  <span className="text-[10px] font-semibold text-accent-gold uppercase tracking-widest">Top Performer</span>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={topPlayer.avatarUrl}
                    alt={topPlayer.name}
                    className="avatar w-10 h-10 sm:w-12 sm:h-12"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${topPlayer.name}`;
                    }}
                  />
                  <div>
                    <div className="font-bold text-text-primary text-base sm:text-lg leading-tight">{topPlayer.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xl sm:text-2xl font-extrabold gradient-text-static font-mono">
                        {standingsView === 'NORMALISED'
                          ? getNormalisedScoreDisplay(topPlayer)
                          : standingsView === 'PPG'
                            ? (topPlayer.played > 0 ? (topPlayer.points / topPlayer.played).toFixed(2) : '0.00')
                            : topPlayer.points}
                      </span>
                      <span className="text-[10px] text-text-muted font-medium">
                        {standingsView === 'NORMALISED' ? 'NORM' : standingsView === 'PPG' ? 'PPG' : 'PTS'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== TAB NAVIGATION ===== */}
      <nav className="sticky top-14 sm:top-16 z-40">
        <div className="absolute inset-0 bg-surface-0/70 backdrop-blur-xl"></div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-none border-b border-glass-border">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="animate-fade-up min-h-[50vh]">
          {activeTab === Tab.STANDINGS && (
            <Standings
              players={playersWithStats}
              view={standingsView}
              onViewChange={setStandingsView}
            />
          )}
          {activeTab === Tab.MATCHES && <MatchList matches={matches} players={playersWithStats} />}
          {activeTab === Tab.DASHBOARD && <Dashboard players={playersWithStats} matches={matches} />}
          {activeTab === Tab.PLAYERS && (
            <PlayerManager players={playersWithStats} onAddPlayer={handleAddPlayer} onDeletePlayer={handleDeletePlayer} />
          )}
          {activeTab === Tab.LOGIN && (
            <div className="space-y-6">
              <Login currentAdmin={currentAdmin} onLogin={(admin) => setCurrentAdmin(admin)} onLogout={() => setCurrentAdmin(null)} />
              {currentAdmin && <LoginDetails />}
            </div>
          )}
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="relative border-t border-glass-border mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Heart className="w-4 h-4 text-text-muted" />
              <span className="text-xs font-medium text-text-muted">Superjoin Health OS</span>
              <span className="text-text-muted">·</span>
              <span className="text-xs text-text-muted">Wellness Leaderboard</span>
            </div>
            <div className="text-[11px] text-text-muted font-medium">
              Powered by <span className="text-text-secondary">Superjoin</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== MATCH FORM MODAL ===== */}
      {showMatchForm && (
        <MatchForm
          players={players}
          onAddMatch={handleAddMatch}
          onCancel={() => setShowMatchForm(false)}
        />
      )}
    </div>
  );
};

export default App;
