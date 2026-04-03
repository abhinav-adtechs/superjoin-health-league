'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { Heart, Activity, Dumbbell, Trophy, Settings, LogOut, ChevronLeft, Search, User, Bell, Plug2, BookOpen, LogIn, RefreshCw, Scale, Ruler, Gauge } from 'lucide-react';

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
import { applyFitnessGoalTheme, getGoalTheme } from '@/lib/fitness-goal-theme';
import { AppLoadingScreen } from '@/components/LoadingScreen';

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

function formatSidebarBmi(weightKg: number | null | undefined, heightCm: number | null | undefined): string {
  if (weightKg == null || weightKg <= 0 || heightCm == null || heightCm <= 0) return '—';
  const h = heightCm / 100;
  const v = weightKg / (h * h);
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(1);
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
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [pointsSheetOpen, setPointsSheetOpen] = useState(false);
  const [guestPointsOpen, setGuestPointsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [refreshingApp, setRefreshingApp] = useState(false);

  /** Tracks which user id `profile` belongs to. When the signed-in user id changes, clear profile to undefined so we don’t render with stale `null` from the logged-out branch (that bypassed the loading shell and crashed / blanked the app). */
  const profileUserIdRef = useRef<string | null>(null);
  const appReloadTimerRef = useRef<number | null>(null);

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
        profileUserIdRef.current = null;
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
        profileUserIdRef.current = null;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      setUser(u ?? null);
      
      if (!u) {
        profileUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      // New or different signed-in user: mark profile as not yet loaded for this user.
      // If we keep `null` from the logged-out path, (user && profile === undefined) is false and the shell skips — main UI can render with profile=null and crash.
      if (profileUserIdRef.current !== u.id) {
        profileUserIdRef.current = u.id;
        setProfile(undefined);
      }

      try {
        const res = await fetch(apiUrl('/api/users/me'), getApiFetchOptions());
        if (!res.ok) {
          console.error('API /api/users/me error:', res.status, res.statusText);
          const errorData = await res.json().catch(() => ({}));
          console.error('Error details:', errorData);
          profileUserIdRef.current = null;
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setProfile(data.profile ?? null);
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        profileUserIdRef.current = null;
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    } catch (e) {
      console.error('loadUser exception:', e);
      profileUserIdRef.current = null;
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

  useEffect(() => {
    return () => {
      if (appReloadTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(appReloadTimerRef.current);
      }
    };
  }, []);

  const handleManualRefresh = useCallback(() => {
    if (typeof window === 'undefined' || refreshingApp) return;
    setRefreshingApp(true);
    appReloadTimerRef.current = window.setTimeout(() => {
      window.location.reload();
    }, 150);
  }, [refreshingApp]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    profileUserIdRef.current = null;
    setUser(null);
    setProfile(undefined);
  };

  // Keep shell loading while profile is in flight for signed-in users (`undefined` = fetch not completed for this session).
  if (loading || (user && profile === undefined)) {
    return <AppLoadingScreen />;
  }

  // Guest mode: leaderboard + rules only
  if (!user && isGuest) {
    return (
      <div className="relative z-10 min-h-screen w-full">
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
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative z-10 min-h-screen w-full">
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
            <p className="hidden md:block text-sm text-text-secondary max-w-md mx-auto">
              Where health becomes a team sport. Fair scoring. Real results. Every step, workout, and healthy habit counts toward your team&apos;s success.
            </p>
            <div className="hidden md:block">
              <HealthGyan />
            </div>
            <p className="text-xs text-text-muted">
              Powered by <span className="font-semibold text-accent-superjoin-orange">Superjoin</span>
            </p>
          </footer>
        </main>
      </div>
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
      <div className="relative z-10 min-h-screen w-full">
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
      </div>
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

  const goalTheme = getGoalTheme(profile!.fitness_goal);
  const weightKg = profile!.current_weight ?? profile!.starting_weight;
  const heightCm = profile!.height_cm;
  const bmiStr = formatSidebarBmi(weightKg, heightCm);
  const weightLabel =
    weightKg != null && weightKg > 0 ? `${weightKg.toFixed(1)} kg` : '—';
  const heightLabel = heightCm != null && heightCm > 0 ? `${Math.round(heightCm)} cm` : '—';

  return (
    <>
      {/* ── Desktop Sidebar — fixed left, hidden on mobile ── */}
      <aside
        data-sidebar-rail={sidebarPinned ? undefined : 'true'}
        className={`glass-sidebar hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-40 min-h-0 overflow-x-hidden overflow-y-hidden group transition-[width] duration-200 ease-in-out ${sidebarPinned ? 'w-64' : 'w-16 hover:w-64'}`}
        style={{
          ['--sidebar-accent-rgb' as string]: goalTheme.primaryRgb,
          ['--sidebar-accent' as string]: goalTheme.primary,
        }}
      >
        {/* Profile, goal, key metrics */}
        <div
          className={`shrink-0 border-b border-slate-200/80 bg-surface-1 safe-area-top transition-[padding] duration-200 ${sidebarPinned ? 'px-3 pt-3 pb-3' : 'px-1.5 pt-3 pb-2'}`}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('settings');
              setSettingsSection('profile');
            }}
            className={`w-full rounded-xl text-left transition-colors hover:bg-slate-200/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-1 ${sidebarPinned ? 'p-2' : 'flex justify-center px-1 py-2 group-hover:justify-start group-hover:px-2'}`}
            style={{ ['--tw-ring-color' as string]: goalTheme.primary }}
            aria-label="Open profile and goals"
          >
            <div
              className={`flex items-center ${sidebarPinned ? 'items-start gap-3' : 'w-full justify-center gap-0 group-hover:justify-start group-hover:gap-3 group-hover:items-start'}`}
            >
              <div
                className="shrink-0 rounded-full p-[2px] shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${goalTheme.primary}, ${goalTheme.primaryLight})`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveAvatarUrl({
                    userId: profile!.id,
                    displayName: profile!.display_name,
                    avatarUrl: profile!.avatar_url,
                  })}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover bg-surface-1 border-2 border-white"
                />
              </div>
              <div
                className={`min-w-0 transition-all duration-200 ${sidebarPinned ? 'flex-1 opacity-100' : 'max-w-0 flex-none overflow-hidden opacity-0 group-hover:max-w-[min(13rem,70vw)] group-hover:flex-1 group-hover:min-w-0 group-hover:opacity-100'}`}
              >
                <p className="text-sm font-semibold text-text-primary truncate leading-tight">{profile!.display_name}</p>
                <span
                  className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border shadow-sm ${goalTheme.badgeClass}`}
                  title="Fitness goal"
                >
                  {goalTheme.label}
                </span>
              </div>
            </div>
          </button>

          <div
            className={`mt-3 grid grid-cols-3 gap-1 rounded-xl border border-slate-200/90 bg-surface-0 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${sidebarPinned ? '' : 'hidden group-hover:grid'}`}
          >
            <div className="flex flex-col items-center gap-0.5 min-w-0 text-center">
              <Scale className="w-3 h-3 text-text-muted shrink-0" aria-hidden />
              <span className="text-[9px] font-semibold uppercase tracking-wide text-text-muted">Weight</span>
              <span className="text-[11px] font-bold text-text-primary tabular-nums truncate w-full">{weightLabel}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 min-w-0 text-center border-x border-slate-200/80">
              <Ruler className="w-3 h-3 text-text-muted shrink-0" aria-hidden />
              <span className="text-[9px] font-semibold uppercase tracking-wide text-text-muted">Height</span>
              <span className="text-[11px] font-bold text-text-primary tabular-nums truncate w-full">{heightLabel}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 min-w-0 text-center">
              <Gauge className="w-3 h-3 text-text-muted shrink-0" aria-hidden />
              <span className="text-[9px] font-semibold uppercase tracking-wide text-text-muted">BMI</span>
              <span className="text-[11px] font-bold text-text-primary tabular-nums truncate w-full">{bmiStr}</span>
            </div>
          </div>

          <p
            className={`mt-2 text-center text-[10px] text-text-muted/90 transition-opacity duration-200 ${sidebarPinned ? 'opacity-100' : 'max-h-0 overflow-hidden opacity-0 group-hover:max-h-8 group-hover:opacity-100'}`}
          >
            Superjoin <span className="font-semibold text-accent-superjoin-orange">Health OS</span>
          </p>
        </div>
        {/* New entry — desktop sidebar only (mobile uses bottom dock FAB) */}
        <div
          className={`shrink-0 border-b border-slate-200/80 bg-surface-1 ${sidebarPinned ? 'px-2.5 py-3' : 'px-2 py-2.5'}`}
        >
          <NewEntryCTA
            profile={profile ?? null}
            onSuccess={() => { loadUser(); setEntryRefresh((r) => r + 1); }}
            placement="sidebar"
            sidebarPinned={sidebarPinned}
          />
        </div>
        {/* Nav items */}
        <nav
          className={`flex-1 min-h-0 py-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden ${sidebarPinned ? 'px-2.5' : 'px-2'}`}
        >
          {TABS.map((tab) => (
            <div key={tab.id}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''} ${sidebarPinned ? '' : 'sidebar-nav-item--rail'}`}
              >
                <tab.icon className="w-5 h-5 shrink-0 opacity-90" />
                <span
                  className={`text-sm font-medium whitespace-nowrap transition-all duration-200 ${sidebarPinned ? 'opacity-100' : 'max-w-0 overflow-hidden opacity-0 group-hover:max-w-[min(14rem,70vw)] group-hover:opacity-100'}`}
                >
                  {tab.label}
                </span>
              </button>
              {/* Settings sub-items — visible when sidebar is expanded */}
              {tab.id === 'settings' && (
                <div
                  className={
                    sidebarPinned
                      ? 'mt-0.5 flex flex-col gap-0.5'
                      : 'hidden group-hover:flex group-hover:mt-0.5 group-hover:flex-col group-hover:gap-0.5'
                  }
                >
                  {SETTINGS_SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setActiveTab('settings'); setSettingsSection(s.id); }}
                      className={`w-full flex items-center gap-2 pl-10 pr-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        activeTab === 'settings' && settingsSection === s.id
                          ? 'text-accent-superjoin-orange bg-slate-200/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]'
                          : 'text-text-muted hover:text-text-secondary hover:bg-slate-200/60'
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
        <div className={`border-t border-slate-200/80 py-2.5 shrink-0 bg-surface-1 ${sidebarPinned ? 'px-2.5' : 'px-2'}`}>
          <button
            onClick={() => setPointsSheetOpen(true)}
            className={`sidebar-nav-item ${pointsSheetOpen ? 'active' : ''} ${sidebarPinned ? '' : 'sidebar-nav-item--rail'}`}
            title="Point System"
          >
            <BookOpen className="w-5 h-5 shrink-0 opacity-90" />
            <span
              className={`text-sm font-medium whitespace-nowrap transition-all duration-200 ${sidebarPinned ? 'opacity-100' : 'max-w-0 overflow-hidden opacity-0 group-hover:max-w-[min(14rem,70vw)] group-hover:opacity-100'}`}
            >
              Point System
            </span>
          </button>
        </div>

        {/* Pin / collapse toggle */}
        <div className={`border-t border-slate-200/80 pt-2 pb-3 shrink-0 bg-surface-1 ${sidebarPinned ? 'px-2.5' : 'px-2'}`}>
          <button
            onClick={() => setSidebarPinned((p) => !p)}
            className={`sidebar-nav-item h-10 rounded-lg border border-transparent text-text-muted hover:text-text-secondary hover:bg-slate-200/80 hover:border-slate-300/80 transition-colors w-full ${sidebarPinned ? '' : 'sidebar-nav-item--rail'}`}
            title={sidebarPinned ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className="w-5 h-5 flex items-center justify-center shrink-0">
              <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${sidebarPinned ? '' : 'rotate-180'}`} />
            </span>
            <span
              className={`text-xs whitespace-nowrap font-medium transition-all duration-200 ${sidebarPinned ? 'opacity-100' : 'max-w-0 overflow-hidden opacity-0 group-hover:max-w-[min(14rem,70vw)] group-hover:opacity-100'}`}
            >
              {sidebarPinned ? 'Collapse' : 'Expand'}
            </span>
          </button>
        </div>
      </aside>

      {/* ── Everything else shifts right of the sidebar ── */}
      <div className={`relative z-10 flex flex-col min-h-screen transition-[margin] duration-200 mobile-app-shell ${sidebarPinned ? 'md:ml-64' : 'md:ml-16'}`}>

        {/* Header */}
        <header className="liquid-header sticky top-0 z-30 safe-area-top mobile-app-header">
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
              {/* Current section — desktop only (sidebar context); hidden on mobile where bottom nav + header are crowded */}
              <div className="hidden md:flex flex-1 min-w-0 md:flex-none justify-center md:justify-start md:ml-0">
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
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={refreshingApp}
                  className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-1 border border-white/10 text-text-muted hover:text-text-secondary disabled:opacity-70 text-xs transition-colors"
                  title="Refresh app"
                  aria-label="Refresh app"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingApp ? 'animate-spin' : ''}`} />
                </button>
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
        <main className="flex-1 min-h-0 mobile-app-content">
          <div className="mobile-app-content-inner">
            <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 pt-2 pb-6 sm:pt-10 sm:pb-10 md:pb-10">
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
            </div>

            <footer className="hidden md:block border-t border-white/10">
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
        </main>

        {/* Point system slide-over — all screen sizes */}
        <PointSystemSheet open={pointsSheetOpen} onClose={() => setPointsSheetOpen(false)} profile={profile ?? undefined} />
      </div>

      {/* ── Mobile Bottom Navigation ── hidden on desktop */}
      <nav className="bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="bottom-nav-liquid bottom-nav-with-fab gap-1">
          <div className="flex min-w-0 flex-1 gap-1">
            {TABS.slice(0, 2).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <tab.icon className="w-[22px] h-[22px]" />
                <span>{tab.shortLabel}</span>
              </button>
            ))}
          </div>
          <div className="relative flex w-[4.75rem] shrink-0 flex-col items-center justify-end overflow-visible bg-transparent pb-0.5">
            <NewEntryCTA
              profile={profile ?? null}
              onSuccess={() => { loadUser(); setEntryRefresh((r) => r + 1); }}
              placement="mobileDock"
            />
          </div>
          <div className="flex min-w-0 flex-1 gap-1">
            {TABS.slice(2, 4).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <tab.icon className="w-[22px] h-[22px]" />
                <span>{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Command Palette — desktop only, Ctrl+/ ── */}
      {commandPaletteOpen && (
        <div
          className="hidden md:flex fixed inset-0 z-[60] items-start justify-center pt-24 bg-slate-900/55 backdrop-blur-none"
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
