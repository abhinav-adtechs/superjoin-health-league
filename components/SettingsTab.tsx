'use client';

import dynamic from 'next/dynamic';
import { User, Bell, Plug2 } from 'lucide-react';
import type { Profile } from '@/lib/types';
import { IntegrationCardsSkeleton, TabContentLoader } from '@/components/LoadingScreen';

const MyStatsTab = dynamic(
  () => import('./MyStatsTab').then((mod) => mod.MyStatsTab),
  { ssr: false, loading: () => <TabContentLoader message="Loading profile..." density="compact" /> },
);
const NotificationsTab = dynamic(
  () => import('./NotificationsTab').then((mod) => mod.NotificationsTab),
  { ssr: false, loading: () => <TabContentLoader message="Loading notifications..." density="compact" /> },
);
const ConnectedAccountsTab = dynamic(
  () => import('./ConnectedAccountsTab').then((mod) => mod.ConnectedAccountsTab),
  { ssr: false, loading: () => <IntegrationCardsSkeleton /> },
);

export type SettingsSection = 'profile' | 'notifications' | 'apps';

const SECTIONS: { id: SettingsSection; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile & Goals', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'apps', label: 'Connected Apps', icon: Plug2 },
];

export function SettingsTab({
  profile,
  onSuccess,
  section,
  onSectionChange,
}: {
  profile: Profile;
  onSuccess: () => void;
  section: SettingsSection;
  onSectionChange: (s: SettingsSection) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Sub-navigation */}
      <div className="flex gap-1 p-1 bg-surface-1 rounded-xl border border-white/10">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSectionChange(s.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              section === s.id
                ? 'bg-surface-0 text-text-primary shadow-sm border border-white/10'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <s.icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{s.label}</span>
            <span className="sm:hidden text-[11px]">{s.id === 'profile' ? 'Profile' : s.id === 'notifications' ? 'Alerts' : 'Apps'}</span>
          </button>
        ))}
      </div>

      {section === 'profile' && <MyStatsTab profile={profile} onSuccess={onSuccess} />}
      {section === 'notifications' && <NotificationsTab />}
      {section === 'apps' && <ConnectedAccountsTab />}
    </div>
  );
}
