'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { Heart, LayoutDashboard, PenLine, Trophy, User, LogOut, Link2 } from 'lucide-react';
import { DashboardTab } from '@/components/DashboardTab';
import { LogEntryTab } from '@/components/LogEntryTab';
import { LeaderboardTab } from '@/components/LeaderboardTab';
import { MyStatsTab } from '@/components/MyStatsTab';
import { ConnectedAccountsTab } from '@/components/ConnectedAccountsTab';
import { NewEntryCTA } from '@/components/NewEntryCTA';
import { LoginForm } from '@/components/LoginForm';
import { OnboardingForm } from '@/components/OnboardingForm';
import { SetPinForm } from '@/components/SetPinForm';
import type { Profile } from '@/lib/types';

type TabId = 'dashboard' | 'log' | 'leaderboard' | 'me' | 'connected';

const TABS: { id: TabId; label: string; icon: typeof Heart }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'log', label: 'Workout history', icon: PenLine },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'me', label: 'Profile & Goals', icon: User },
  { id: 'connected', label: 'Connected', icon: Link2 },
];

export default function Home() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'connected') return 'connected';
    }
    return 'dashboard';
  });
  const [loading, setLoading] = useState(true);
  const [entryRefresh, setEntryRefresh] = useState(0);

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
    console.log('Home component mounted, starting loadUser...');
    
    // Safety timeout - if loading takes more than 5 seconds, force it to false
    const safetyTimeout = setTimeout(() => {
      console.warn('Safety timeout: forcing loading to false');
      setLoading(false);
    }, 5000);
    
    loadUser().finally(() => {
      clearTimeout(safetyTimeout);
    });
    
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
      clearTimeout(safetyTimeout);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadUser]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(undefined);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-text-muted font-medium">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <header className="sticky top-0 z-50 border-b border-white/20 bg-surface-0/80 backdrop-blur-xl">
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
            </div>
          </div>
          <footer className="mt-8 sm:mt-12 pb-6 sm:pb-8 text-center space-y-2">
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              Where health becomes a team sport. Fair scoring. Real results. Every step, workout, and healthy habit counts toward your team&apos;s success.
            </p>
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
      <>
        <header className="sticky top-0 z-50 border-b border-white/20 bg-surface-0/80 backdrop-blur-xl">
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
        <main className="max-w-lg mx-auto px-4 py-12">
          <div className="glass-card p-8">
            <h1 className="text-xl font-bold text-text-primary mb-2">Create your profile</h1>
            <p className="text-sm text-text-secondary mb-6">One-time setup. All fields required for fair scoring (e.g. age bracket for step thresholds).</p>
            <OnboardingForm onSuccess={loadUser} />
          </div>
        </main>
      </>
    );
  }

  const pinExpired =
    profile?.pin_set_at &&
    Date.now() - new Date(profile.pin_set_at).getTime() > 60 * 24 * 60 * 60 * 1000;
  if (user && profile && profile.must_change_pin) {
    return (
      <>
        <header className="sticky top-0 z-50 border-b border-white/20 bg-surface-0/80 backdrop-blur-xl">
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

  return (
    <>
        <header className="sticky top-0 z-50 border-b border-white/20 bg-surface-0/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="h-14 sm:h-16 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-accent-superjoin-orange" />
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-sm sm:text-base font-bold text-text-primary">Superjoin</span>
                  <span className="text-sm sm:text-base font-bold text-accent-superjoin-orange">Health OS</span>
                </div>
              </div>
            <div className="flex items-center gap-2">
              <NewEntryCTA profile={profile ?? null} onSuccess={() => { loadUser(); setEntryRefresh((r) => r + 1); }} />
              <div className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-surface-1 border border-white/10">
                <div className="w-6 h-6 rounded-full bg-accent-superjoin-orange/20 border border-accent-superjoin-orange/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-semibold text-accent-superjoin-orange leading-none">
                    {profile?.display_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs font-medium text-text-secondary hidden sm:inline max-w-[120px] truncate">{profile?.display_name}</span>
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

      <div className="sticky top-14 sm:top-16 z-40 bg-surface-0/70 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-xs sm:text-sm text-text-secondary py-3 sm:py-2 text-center sm:text-left font-medium">
            The operating system for workplace wellness. Built for teams who compete, improve, and win together.
          </p>
          <div className="flex items-center gap-1 py-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-item relative ${activeTab === tab.id ? 'active' : ''}`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {activeTab === 'dashboard' && <DashboardTab profile={profile!} onRefresh={loadUser} refreshTrigger={entryRefresh} />}
        {activeTab === 'log' && <LogEntryTab profile={profile!} onSuccess={loadUser} refreshTrigger={entryRefresh} />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
        {activeTab === 'me' && <MyStatsTab profile={profile!} onSuccess={loadUser} />}
        {activeTab === 'connected' && <ConnectedAccountsTab />}
      </main>

      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-sm text-text-secondary text-center max-w-2xl mx-auto leading-relaxed">
            Superjoin Health OS turns health into a shared mission. Every step, workout, and healthy habit counts toward your team&apos;s success — fair scoring, real results.
          </p>
          <p className="text-xs text-text-muted text-center mt-4">
            Powered by <span className="font-semibold text-accent-superjoin-orange">Superjoin</span>
          </p>
        </div>
      </footer>
    </>
  );
}
