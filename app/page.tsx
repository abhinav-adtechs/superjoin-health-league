'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { Heart, Activity, Dumbbell, Trophy, Settings, LogOut, ChevronLeft, Search, User, Bell, Plug2, BookOpen, LogIn } from 'lucide-react';

import { DashboardTab } from '@/components/DashboardTab';
import { LogEntryTab } from '@/components/LogEntryTab';
import { LeaderboardTab } from '@/components/LeaderboardTab';
import { SettingsTab, type SettingsSection } from '@/components/SettingsTab';
import { NewEntryCTA } from '@/components/NewEntryCTA';
import { LoginForm } from '@/components/LoginForm';
import GoalSetupWizard from '@/components/GoalSetupWizard';
import { SetPinForm } from '@/components/SetPinForm';
import { PointSystemSheet } from '@/components/PointSystemPanel';
import type { Profile } from '@/lib/types';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import { applyFitnessGoalTheme } from '@/lib/fitness-goal-theme';

/** True when the profile has no usable goal targets yet (DB dummy migration fills these for most users). */
function profileNeedsGoals(p: Profile): boolean {
  const has =
    (p.goal_workout_mins_week != null && p.goal_workout_mins_week > 0) ||
    (p.goal_workout_days_week != null && p.goal_workout_days_week > 0) ||
    ((p.goal_sleep_hours ?? p.goal_sleep_hours_min) != null &&
      Number(p.goal_sleep_hours ?? p.goal_sleep_hours_min) > 0) ||
    (p.goal_water_liters != null && p.goal_water_liters > 0) ||
    (p.goal_protein_g_day != null && p.goal_protein_g_day > 0) ||
    (p.goal_calories_day != null && p.goal_calories_day > 0) ||
    (p.goal_steps_day != null && p.goal_steps_day > 0);
  return !has;
}

type TabId = 'dashboard' | 'log' | 'leaderboard' | 'settings';

const TABS: { id: TabId; label: string; shortLabel: string; icon: typeof Heart }[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: Activity },
  { id: 'log', label: 'Health & Activity Log', shortLabel: 'Log', icon: Dumbbell },
  { id: 'leaderboard', label: 'Leaderboard', shortLabel: 'League', icon: Trophy },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: typeof Heart }[] = [
  { id: 'profile', label: 'Profile & Goals', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'apps', label: 'Connected Apps', icon: Plug2 },
];

const HEALTH_GYAN = [
  'A 10-minute walk after meals can help regulate blood sugar.',
  'Sleep is when your body repairs muscle and consolidates memory.',
  'Staying hydrated improves focus and keeps energy levels steady.',
  'Small, consistent habits beat big, rare efforts every time.',
  'Movement is medicine — even a little beats none.',
  'Eating slowly helps you feel full and digest better.',
  'Standing or walking for 2 minutes every hour offsets sitting.',
  'Morning sunlight helps set your circadian rhythm and mood.',
  'Strength training 2x a week supports bones and metabolism.',
  'Breathing deeply for a few minutes can lower stress and blood pressure.',
];

function HealthGyan() {
  const [gyan] = useState(() => HEALTH_GYAN[Math.floor(Math.random() * HEALTH_GYAN.length)]);
  return (
    <p className="text-xs text-text-muted italic max-w-md mx-auto border-l-2 border-accent-superjoin-orange/30 pl-3 py-1">
      {gyan}
    </p>
  );
}

export default function Home() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [isGuest, setIsGuest] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'connected' || tab === 'notifications' || tab === 'me') return 'settings';
    }
    return 'dashboard';
  });
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'notifications') return 'notifications';
      if (tab === 'connected') return 'apps';
    }
    return 'profile';
  });
  const [loading, setLoading] = useState(true);
  const [entryRefresh, setEntryRefresh] = useState(0);
  /** When set from the dashboard month league CTA, leaderboard opens on monthly view for this YYYY-MM. */
  const [leaderboardOpenContext, setLeaderboardOpenContext] = useState<{ month: string } | null>(null);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [pointsSheetOpen, setPointsSheetOpen] = useState(false);
  const [guestPointsOpen, setGuestPointsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);

  const loadUser = useCallback(async () => {
    console.log('loadUser called');
    try {
      let supabase;
      try {
        console.log('Creating Supabase client...');
        supabase = createClient();
        console.log('Supabase client created successfully');
      } catch (clientError) {
        console.error('Failed to create Supabase client:', clientError);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      console.log('Calling getUser()...');
      const { data: { user: u }, error: authError } = await supabase.auth.getUser();
      console.log('getUser() completed, user:', u ? 'exists' : 'null', 'error:', authError);
      
      if (authError) {
        console.error('Auth getUser error:', authError);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      setUser(u ?? null);
      
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(apiUrl('/api/users/me'), getApiFetchOptions());
        if (!res.ok) {
          console.error('API /api/users/me error:', res.status, res.statusText);
          const errorData = await res.json().catch(() => ({}));
          console.error('Error details:', errorData);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setProfile(data.profile ?? null);
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    } catch (e) {
      console.error('loadUser exception:', e);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    let unsubscribe: (() => void) | null = null;
    try {
      const supabase = createClient();
      const result = supabase.auth.onAuthStateChange(() => {
        loadUser();
      });
      if (result?.data?.subscription?.unsubscribe) {
        unsubscribe = () => result.data.subscription.unsubscribe();
      }
    } catch (e) {
      console.error('Failed to set up auth listener:', e);
    }
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadUser]);

  useEffect(() => {
    applyFitnessGoalTheme(profile?.fitness_goal ?? null);
  }, [profile?.fitness_goal]);

  useEffect(() => {
    if (activeTab !== 'leaderboard') setLeaderboardOpenContext(null);
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.ctrlKey && e.key === '/' && !isInput) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        setPaletteQuery('');
        setPaletteIdx(0);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setPaletteQuery('');
        setPaletteIdx(0);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(undefined);
  };

  // Keep shell loading while profile is in flight for signed-in users. The 5s safety timeout can
  // clear `loading` before /api/users/me returns, which would otherwise render Dashboard with
  // profile undefined and crash on profile! assertions.
  if (loading || (user && profile === undefined)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-text-muted font-medium">Loading…</div>
      </div>
    );
  }

  // Guest mode: leaderboard + rules only
  if (!user && isGuest) {
    return (
      <>
        <header className="sticky top-0 z-50 safe-area-top border-b border-white/20 bg-surface-0/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-accent-superjoin-orange" />
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-sm sm:text-base font-bold text-text-primary">Superjoin</span>
                  <span className="text-sm sm:text-base font-bold text-accent-superjoin-orange">Health OS</span>
                </div>
                <span className="text-[10px] font-medium text-text-muted bg-surface-1 border border-white/10 rounded-md px-1.5 py-0.5 hidden sm:inline">Guest</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGuestPointsOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-1 border border-white/10 text-text-muted hover:text-text-secondary text-sm font-medium transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  Rules
                </button>
                <button
                  onClick={() => { setIsGuest(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 text-accent-superjoin-orange hover:bg-accent-superjoin-orange/20 text-sm font-medium transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 min-h-[calc(100vh-80px)]">
          <LeaderboardTab />
          <PointSystemSheet open={guestPointsOpen} onClose={() => setGuestPointsOpen(false)} />
        </main>
        <footer className="border-t border-white/10 py-6">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-text-muted">
              Sign in to log your activity and compete on the leaderboard.
            </p>
          </div>
        </footer>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <header className="sticky top-0 z-50 safe-area-top border-b border-white/20 bg-surface-0/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-accent-superjoin-orange" />
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-sm sm:text-base font-bold text-text-primary">Superjoin</span>
                  <span className="text-sm sm:text-base font-bold text-accent-superjoin-orange">Health OS</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 py-8 sm:py-12 min-h-[calc(100vh-80px)] flex flex-col">
          <div className="text-center mb-6 sm:mb-8">
            <p className="text-sm sm:text-base text-text-secondary font-medium max-w-xl mx-auto leading-relaxed">
              The operating system for workplace wellness. Built for teams who compete, improve, and win together.
            </p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="glass-card p-6 sm:p-8 w-full">
              <div className="flex flex-col items-center mb-6 sm:mb-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-accent-superjoin-orange/10 border-2 border-accent-superjoin-orange/20 flex items-center justify-center mb-4">
                  <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-accent-superjoin-orange" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-text-primary mb-2 text-center">Sign in</h1>
                <p className="text-xs sm:text-sm text-text-secondary text-center max-w-sm">Log your daily health in 30 seconds. Points for actions, not logging.</p>
              </div>
              <LoginForm onSuccess={loadUser} />
              <div className="mt-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsGuest(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-text-muted hover:text-text-secondary hover:bg-surface-1 border border-white/10 transition-colors"
                >
                  Continue as guest
                </button>
                <p className="text-[11px] text-text-muted text-center mt-2">View leaderboard and rules without signing in</p>
              </div>
            </div>
          </div>
          <footer className="mt-8 sm:mt-12 pb-6 sm:pb-8 text-center space-y-3">
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              Where health becomes a team sport. Fair scoring. Real results. Every step, workout, and healthy habit counts toward your team&apos;s success.
            </p>
            <HealthGyan />
            <p className="text-xs text-text-muted">
              Powered by <span className="font-semibold text-accent-superjoin-orange">Superjoin</span>
            </p>
          </footer>
        </main>
      </>
    );
  }

  if (profile === null && user) {
    return (
      <GoalSetupWizard
        isNewUser
        onComplete={loadUser}
      />
    );
  }

  const pinExpired =
    profile?.pin_set_at &&
    Date.now() - new Date(profile.pin_set_at).getTime() > 60 * 24 * 60 * 60 * 1000;
  if (user && profile && profile.must_change_pin) {
    return (
      <>
        <header className="sticky top-0 z-50 safe-area-top border-b border-white/20 bg-surface-0/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
                <Heart className="w-5 h-5 text-accent-green" />
              </div>
              <span className="font-bold text-text-primary">Superjoin Health OS</span>
            </div>
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 py-12">
          <div className="glass-card p-8">
            <h1 className="text-xl font-bold text-text-primary mb-2">Set new PIN</h1>
            <SetPinForm onSuccess={loadUser} pinExpired={!!pinExpired} />
          </div>
        </main>
      </>
    );
  }

  if (user && profile && profileNeedsGoals(profile)) {
    return (
      <GoalSetupWizard
        isNewUser={false}
        existingProfile={profile}
        onComplete={loadUser}
      />
    );
  }

  // ── Command palette items (tabs + settings sub-sections) ─────────────────
  type PaletteItem = {
    id: string;
    label: string;
    parentLabel?: string;
    icon: typeof Heart;
    onSelect: () => void;
    isActive: boolean;
  };
  const allPaletteItems: PaletteItem[] = [
    ...TABS.map((tab) => ({
      id: `tab-${tab.id}`,
      label: tab.label,
      icon: tab.icon,
      onSelect: () => {
        setActiveTab(tab.id);
        setCommandPaletteOpen(false);
        setPaletteQuery('');
        setPaletteIdx(0);
      },
      isActive: activeTab === tab.id && tab.id !== 'settings',
    })),
    ...SETTINGS_SECTIONS.map((s) => ({
      id: `settings-${s.id}`,
      label: s.label,
      parentLabel: 'Settings',
      icon: s.icon,
      onSelect: () => {
        setActiveTab('settings');
        setSettingsSection(s.id);
        setCommandPaletteOpen(false);
        setPaletteQuery('');
        setPaletteIdx(0);
      },
      isActive: activeTab === 'settings' && settingsSection === s.id,
    })),
    {
      id: 'point-system',
      label: 'Point System',
      icon: BookOpen,
      onSelect: () => {
        setPointsSheetOpen(true);
        setCommandPaletteOpen(false);
        setPaletteQuery('');
        setPaletteIdx(0);
      },
      isActive: pointsSheetOpen,
    },
  ];
  const filteredPaletteItems = allPaletteItems.filter(
    (item) =>
      item.label.toLowerCase().includes(paletteQuery.toLowerCase()) ||
      item.parentLabel?.toLowerCase().includes(paletteQuery.toLowerCase()),
  );
  const safePaletteIdx = filteredPaletteItems.length > 0
    ? Math.min(paletteIdx, filteredPaletteItems.length - 1)
    : 0;

  return (
    <>
      {/* ── Desktop Sidebar — fixed left, hidden on mobile ── */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-40 border-r border-white/10 bg-surface-0/95 backdrop-blur-xl transition-[width] duration-200 ease-in-out overflow-hidden group ${sidebarPinned ? 'w-56' : 'w-14 hover:w-56'}`}
      >
        {/* Sidebar logo */}
        <div className="flex items-center h-14 sm:h-16 px-2.5 border-b border-white/10 shrink-0 safe-area-top">
          <div className="w-9 h-9 rounded-xl bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-accent-superjoin-orange" />
          </div>
          <div className={`ml-3 whitespace-nowrap transition-opacity duration-150 ${sidebarPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <span className="text-sm font-bold text-text-primary">Superjoin </span>
            <span className="text-sm font-bold text-accent-superjoin-orange">Health OS</span>
          </div>
        </div>
        {/* Nav items */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-hidden">
          {TABS.map((tab) => (
            <div key={tab.id}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <tab.icon className="w-5 h-5 shrink-0" />
                <span className={`ml-3 text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${sidebarPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {tab.label}
                </span>
              </button>
              {/* Settings sub-items — visible when sidebar is expanded */}
              {tab.id === 'settings' && (
                <div className={`mt-0.5 flex flex-col gap-0.5 transition-opacity duration-150 ${sidebarPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {SETTINGS_SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setActiveTab('settings'); setSettingsSection(s.id); }}
                      className={`w-full flex items-center gap-2 pl-10 pr-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        activeTab === 'settings' && settingsSection === s.id
                          ? 'text-accent-superjoin-orange bg-accent-superjoin-orange/10'
                          : 'text-text-muted hover:text-text-secondary hover:bg-surface-1'
                      }`}
                    >
                      <s.icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        {/* Point System trigger */}
        <div className="border-t border-white/10 px-2 py-2 shrink-0">
          <button
            onClick={() => setPointsSheetOpen(true)}
            className={`sidebar-nav-item ${pointsSheetOpen ? 'active' : ''}`}
            title="Point System"
          >
            <BookOpen className="w-5 h-5 shrink-0" />
            <span className={`ml-3 text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${sidebarPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              Point System
            </span>
          </button>
        </div>

        {/* Pin / collapse toggle */}
        <button
          onClick={() => setSidebarPinned((p) => !p)}
          className="flex items-center pl-5 pr-3 h-10 border-t border-white/10 text-text-muted hover:text-text-secondary hover:bg-surface-1 transition-colors shrink-0"
          title={sidebarPinned ? 'Collapse sidebar' : 'Pin sidebar open'}
        >
          <ChevronLeft className={`w-4 h-4 shrink-0 transition-transform duration-200 ${sidebarPinned ? '' : 'rotate-180'}`} />
          <span className={`ml-3 text-xs whitespace-nowrap font-medium transition-opacity duration-150 ${sidebarPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            Collapse
          </span>
        </button>
      </aside>

      {/* ── Everything else shifts right of the sidebar ── */}
      <div className={`flex flex-col min-h-screen transition-[margin] duration-200 ${sidebarPinned ? 'md:ml-56' : 'md:ml-14'}`}>

        {/* Header */}
        <header className="sticky top-0 z-30 safe-area-top border-b border-white/20 bg-surface-0/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
              {/* Logo — mobile only (desktop shows in sidebar) */}
              <div className="flex items-center gap-2 md:hidden shrink-0">
                <div className="w-8 h-8 rounded-xl bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4 text-accent-superjoin-orange" />
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-sm font-bold text-text-primary truncate">Superjoin</span>
                  <span className="text-sm font-bold text-accent-superjoin-orange truncate">Health OS</span>
                </div>
              </div>
              {/* Current section — centered on mobile (matches desktop sidebar context), left on md+ */}
              <div className="flex-1 min-w-0 md:flex-none flex justify-center md:justify-start md:ml-0">
                <span className="text-sm font-semibold text-text-primary truncate text-center md:text-left px-1">
                  {TABS.find((t) => t.id === activeTab)?.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Command palette trigger — desktop only */}
                <button
                  onClick={() => { setCommandPaletteOpen(true); setPaletteQuery(''); }}
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-1 border border-white/10 text-text-muted hover:text-text-secondary text-xs transition-colors"
                  title="Open navigation palette"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Navigate</span>
                  <kbd className="ml-0.5 px-1.5 py-0.5 rounded text-[10px] bg-surface-0 border border-white/10 font-mono">Ctrl+/</kbd>
                </button>
                {/* Points button — mobile only (desktop uses left sidebar) */}
                <button
                  onClick={() => setPointsSheetOpen(true)}
                  className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-1 border border-white/10 text-text-muted hover:text-text-secondary text-xs transition-colors"
                  title="Point system"
                  aria-label="Open point system"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
                <NewEntryCTA profile={profile ?? null} onSuccess={() => { loadUser(); setEntryRefresh((r) => r + 1); }} />
                <div className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-surface-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('settings'); setSettingsSection('profile'); }}
                    className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    aria-label="Profile & Settings"
                  >
                    {profile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveAvatarUrl({
                          userId: profile.id,
                          displayName: profile.display_name,
                          avatarUrl: profile.avatar_url,
                        })}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/10 bg-surface-2"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-accent-superjoin-orange/20 border border-accent-superjoin-orange/30 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-semibold text-accent-superjoin-orange leading-none">?</span>
                      </div>
                    )}
                    <span className="text-xs font-medium text-text-secondary hidden sm:inline max-w-[120px] truncate">{profile?.display_name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-0.5 rounded-full text-text-muted hover:text-text-primary transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 min-h-0 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 pb-28 md:pb-10">
          {activeTab === 'dashboard' && (
            <DashboardTab
              profile={profile!}
              onRefresh={loadUser}
              refreshTrigger={entryRefresh}
              onOpenLeaderboard={() => {
                const d = new Date();
                const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                setLeaderboardOpenContext({ month });
                setActiveTab('leaderboard');
              }}
            />
          )}
          {activeTab === 'log' && (
            <LogEntryTab
              profile={profile!}
              onSuccess={() => {
                loadUser();
                setEntryRefresh((r) => r + 1);
              }}
              refreshTrigger={entryRefresh}
            />
          )}
          {activeTab === 'leaderboard' && (
            <LeaderboardTab
              key={leaderboardOpenContext ? `lb-${leaderboardOpenContext.month}` : 'lb'}
              initialView={leaderboardOpenContext ? 'monthly' : undefined}
              initialMonth={leaderboardOpenContext?.month}
              profile={profile ?? undefined}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              profile={profile!}
              onSuccess={loadUser}
              section={settingsSection}
              onSectionChange={setSettingsSection}
            />
          )}
        </main>

        {/* Point system slide-over — all screen sizes */}
        <PointSystemSheet open={pointsSheetOpen} onClose={() => setPointsSheetOpen(false)} profile={profile ?? undefined} />

        <footer className="border-t border-white/10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <p className="text-sm text-text-secondary text-center max-w-2xl mx-auto leading-relaxed">
              Superjoin Health OS turns health into a shared mission. Every step, workout, and healthy habit counts toward your team&apos;s success — fair scoring, real results.
            </p>
            <p className="text-xs text-text-muted text-center mt-4">
              Powered by <span className="font-semibold text-accent-superjoin-orange">Superjoin</span>
            </p>
          </div>
        </footer>
      </div>

      {/* ── Mobile Bottom Navigation ── hidden on desktop */}
      <nav className="bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="flex items-stretch">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon className="w-[22px] h-[22px]" />
              <span>{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Command Palette — desktop only, Ctrl+/ ── */}
      {commandPaletteOpen && (
        <div
          className="hidden md:flex fixed inset-0 z-[60] items-start justify-center pt-24 bg-black/20 backdrop-blur-sm"
          onClick={() => { setCommandPaletteOpen(false); setPaletteQuery(''); setPaletteIdx(0); }}
        >
          <div
            className="w-full max-w-md mx-4 bg-surface-0 border border-white/20 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input
                autoFocus
                type="text"
                value={paletteQuery}
                onChange={(e) => { setPaletteQuery(e.target.value); setPaletteIdx(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setPaletteIdx((i) => Math.min(i + 1, filteredPaletteItems.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setPaletteIdx((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    filteredPaletteItems[safePaletteIdx]?.onSelect();
                  }
                }}
                placeholder="Navigate to..."
                className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted"
              />
              <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-surface-1 border border-white/10 text-text-muted font-mono">Esc</kbd>
            </div>
            {/* Item list */}
            <div className="py-1.5 max-h-80 overflow-y-auto">
              {filteredPaletteItems.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={item.onSelect}
                  onMouseEnter={() => setPaletteIdx(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                    idx === safePaletteIdx ? 'bg-surface-1' : ''
                  } ${item.isActive ? 'text-accent-superjoin-orange' : 'text-text-secondary'}`}
                >
                  {item.parentLabel && <span className="w-3 shrink-0" />}
                  <item.icon className={`w-4 h-4 shrink-0 ${item.parentLabel ? 'text-text-muted' : ''}`} />
                  <span className="flex-1 flex items-center gap-1.5">
                    {item.parentLabel && (
                      <span className="text-text-muted text-xs">{item.parentLabel} /</span>
                    )}
                    {item.label}
                  </span>
                  {item.isActive && (
                    <span className="text-[10px] text-text-muted font-medium">current</span>
                  )}
                  {idx === safePaletteIdx && !item.isActive && (
                    <kbd className="text-[10px] px-1 py-0.5 rounded bg-surface-0 border border-white/10 text-text-muted font-mono">↵</kbd>
                  )}
                </button>
              ))}
              {filteredPaletteItems.length === 0 && (
                <p className="px-4 py-4 text-sm text-text-muted text-center">No sections found</p>
              )}
            </div>
            {/* Footer hints */}
            <div className="px-4 py-2.5 border-t border-white/10 flex items-center gap-4 text-[10px] text-text-muted">
              <span><kbd className="px-1 py-0.5 rounded bg-surface-1 border border-white/10 font-mono">↵</kbd> Open</span>
              <span><kbd className="px-1 py-0.5 rounded bg-surface-1 border border-white/10 font-mono">↑↓</kbd> Navigate</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-surface-1 border border-white/10 font-mono">Esc</kbd> Close</span>
              <span className="ml-auto"><kbd className="px-1.5 py-0.5 rounded bg-surface-1 border border-white/10 font-mono">Ctrl+/</kbd> Toggle</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
