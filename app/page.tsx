'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { Heart, Activity, Dumbbell, Trophy, Settings, LogOut, ChevronLeft, Search, User, Bell, Plug2 } from 'lucide-react';
import { DashboardTab } from '@/components/DashboardTab';
import { LogEntryTab } from '@/components/LogEntryTab';
import { LeaderboardTab } from '@/components/LeaderboardTab';
import { SettingsTab, type SettingsSection } from '@/components/SettingsTab';
import { NewEntryCTA } from '@/components/NewEntryCTA';
import { LoginForm } from '@/components/LoginForm';
import { OnboardingForm } from '@/components/OnboardingForm';
import { SetPinForm } from '@/components/SetPinForm';
import type { Profile } from '@/lib/types';

type TabId = 'dashboard' | 'log' | 'leaderboard' | 'settings';

const TABS: { id: TabId; label: string; shortLabel: string; icon: typeof Heart }[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: Activity },
  { id: 'log', label: 'Workout history', shortLabel: 'History', icon: Dumbbell },
  { id: 'leaderboard', label: 'Leaderboard', shortLabel: 'League', icon: Trophy },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: typeof Heart }[] = [
  { id: 'profile', label: 'Profile & Goals', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'apps', label: 'Connected Apps', icon: Plug2 },
];

export default function Home() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
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
  const [sidebarPinned, setSidebarPinned] = useState(false);
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
        <div className="flex items-center h-14 sm:h-16 px-2.5 border-b border-white/10 shrink-0">
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
        {/* Pin / collapse toggle */}
        <button
          onClick={() => setSidebarPinned((p) => !p)}
          className="flex items-center px-3 h-10 border-t border-white/10 text-text-muted hover:text-text-secondary hover:bg-surface-1 transition-colors shrink-0"
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
        <header className="sticky top-0 z-30 border-b border-white/20 bg-surface-0/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
              {/* Logo — mobile only (desktop shows in sidebar) */}
              <div className="flex items-center gap-2 md:hidden">
                <div className="w-8 h-8 rounded-xl bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4 text-accent-superjoin-orange" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-text-primary">Superjoin</span>
                  <span className="text-sm font-bold text-accent-superjoin-orange">Health OS</span>
                </div>
              </div>
              {/* Desktop header left — current section label */}
              <div className="hidden md:flex items-center">
                <span className="text-sm font-semibold text-text-primary">
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
                <NewEntryCTA profile={profile ?? null} onSuccess={() => { loadUser(); setEntryRefresh((r) => r + 1); }} />
                <div className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-surface-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('settings'); setSettingsSection('profile'); }}
                    className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    aria-label="Profile & Settings"
                  >
                    <div className="w-6 h-6 rounded-full bg-accent-superjoin-orange/20 border border-accent-superjoin-orange/30 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-accent-superjoin-orange leading-none">
                        {profile?.display_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
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
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 pb-28 md:pb-10">
          {activeTab === 'dashboard' && <DashboardTab profile={profile!} onRefresh={loadUser} refreshTrigger={entryRefresh} />}
          {activeTab === 'log' && <LogEntryTab profile={profile!} onSuccess={loadUser} refreshTrigger={entryRefresh} />}
          {activeTab === 'leaderboard' && <LeaderboardTab />}
          {activeTab === 'settings' && (
            <SettingsTab
              profile={profile!}
              onSuccess={loadUser}
              section={settingsSection}
              onSectionChange={setSettingsSection}
            />
          )}
        </main>

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
