'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Link2,
  Link2Off,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Activity,
  Dumbbell,
  Moon,
  Droplets,
  Footprints,
  Scale,
  Utensils,
  Clock,
  AlertCircle,
  Smartphone,
  Zap,
} from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { IntegrationStatus, SyncPreference } from '@/lib/types';
import { requestHealthKitPermissions, isHealthKitAvailable, syncHealthKitToApi } from '@/lib/integrations/apple-health';

// ── Platform metadata ────────────────────────────────────────────────────────

interface PlatformMeta {
  id: 'fitbit' | 'apple_health' | 'google_health';
  name: string;
  tagline: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  available: boolean;
  comingSoon?: boolean;
  authType: 'oauth' | 'native' | 'coming_soon';
  dataFields: DataFieldMeta[];
}

interface DataFieldMeta {
  key: string;
  label: string;
  icon: React.ReactNode;
  available: boolean;
  note?: string;
}

const FIELD_ICONS: Record<string, React.ReactNode> = {
  steps: <Footprints className="w-3.5 h-3.5" />,
  workout: <Dumbbell className="w-3.5 h-3.5" />,
  cardio: <Activity className="w-3.5 h-3.5" />,
  sleep: <Moon className="w-3.5 h-3.5" />,
  water: <Droplets className="w-3.5 h-3.5" />,
  protein: <Utensils className="w-3.5 h-3.5" />,
  weight: <Scale className="w-3.5 h-3.5" />,
  sleep_quality: <Zap className="w-3.5 h-3.5" />,
};

const APPLE_HEALTH_FIELDS: DataFieldMeta[] = [
  { key: 'steps', label: 'Daily steps', icon: FIELD_ICONS.steps, available: true },
  { key: 'workout', label: 'Workout (type + duration)', icon: FIELD_ICONS.workout, available: true },
  { key: 'cardio', label: 'Cardio (type + duration)', icon: FIELD_ICONS.cardio, available: true },
  { key: 'sleep', label: 'Sleep hours', icon: FIELD_ICONS.sleep, available: true },
  { key: 'water', label: 'Water intake', icon: FIELD_ICONS.water, available: true, note: 'If logged in a nutrition app' },
  { key: 'protein', label: 'Protein intake', icon: FIELD_ICONS.protein, available: true, note: 'If logged in a nutrition app' },
  { key: 'weight', label: 'Body weight', icon: FIELD_ICONS.weight, available: true },
  { key: 'sleep_quality', label: 'Sleep quality', icon: FIELD_ICONS.sleep_quality, available: false, note: 'HealthKit has no quality score — log manually' },
];

const FITBIT_FIELDS: DataFieldMeta[] = [
  { key: 'steps', label: 'Daily steps', icon: FIELD_ICONS.steps, available: true },
  { key: 'workout', label: 'Workout (type + duration)', icon: FIELD_ICONS.workout, available: true },
  { key: 'cardio', label: 'Cardio (type + duration)', icon: FIELD_ICONS.cardio, available: true },
  { key: 'sleep', label: 'Sleep hours', icon: FIELD_ICONS.sleep, available: true },
  { key: 'sleep_quality', label: 'Sleep quality score', icon: FIELD_ICONS.sleep_quality, available: true, note: 'Derived from Fitbit sleep efficiency' },
  { key: 'water', label: 'Water intake', icon: FIELD_ICONS.water, available: true, note: 'If logged in Fitbit app' },
  { key: 'protein', label: 'Protein intake', icon: FIELD_ICONS.protein, available: true, note: 'If logged in Fitbit food log' },
  { key: 'weight', label: 'Body weight', icon: FIELD_ICONS.weight, available: true, note: 'If logged on Fitbit scale' },
];

const GOOGLE_FIELDS: DataFieldMeta[] = [
  { key: 'steps', label: 'Daily steps', icon: FIELD_ICONS.steps, available: true },
  { key: 'workout', label: 'Workout (type + duration)', icon: FIELD_ICONS.workout, available: true },
  { key: 'cardio', label: 'Cardio (type + duration)', icon: FIELD_ICONS.cardio, available: true },
  { key: 'sleep', label: 'Sleep hours', icon: FIELD_ICONS.sleep, available: true },
  { key: 'water', label: 'Water intake', icon: FIELD_ICONS.water, available: true },
  { key: 'weight', label: 'Body weight', icon: FIELD_ICONS.weight, available: true },
];

// ── Platform logo SVGs (inline, no external deps) ────────────────────────────

function AppleHealthLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* White rounded rect background */}
      <rect width="32" height="32" rx="7" fill="white" />
      {/* Heart shape */}
      <path
        d="M16 25.5C15.6 25.1 5 18.2 5 11.8C5 8.1 7.8 5.5 11 5.5C13.2 5.5 15.1 6.7 16 8.5C16.9 6.7 18.8 5.5 21 5.5C24.2 5.5 27 8.1 27 11.8C27 18.2 16.4 25.1 16 25.5Z"
        fill="url(#ah-heart)"
      />
      {/* White medical cross */}
      <rect x="14.5" y="11" width="3" height="8" rx="1.5" fill="white" />
      <rect x="11" y="14.5" width="10" height="3" rx="1.5" fill="white" />
      <defs>
        <linearGradient id="ah-heart" x1="16" y1="5" x2="16" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF2D55" />
          <stop offset="100%" stopColor="#FF6B81" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function AppleFitnessLogo({ size = 28 }: { size?: number }) {
  // Three activity rings using precise SVG arc paths — much cleaner than dasharray at small sizes
  // Ring radii: Move r=12, Exercise r=8.5, Stand r=5
  // Arc start: top of each circle (16, cy-r). Arc angles: 300°, 240°, 190° clockwise
  // Endpoints calculated: end_x = 16 + r·cos(θ), end_y = 16 + r·sin(θ) where θ = -90 + degrees
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* No background rect — the card container provides the translucent fill */}
      {/* Dim ghost rings so the arcs read as "almost complete circles" */}
      <circle cx="16" cy="16" r="12"  stroke="#FF375F" strokeWidth="2.8" opacity="0.22" />
      <circle cx="16" cy="16" r="8.5" stroke="#30D158" strokeWidth="2.8" opacity="0.22" />
      <circle cx="16" cy="16" r="5"   stroke="#64D2FF" strokeWidth="2.8" opacity="0.22" />
      {/* Move ring — red, 300° arc. End: (5.61, 10) */}
      <path d="M16 4 A12 12 0 1 1 5.61 10" stroke="#FF375F" strokeWidth="2.8" strokeLinecap="round" />
      {/* Exercise ring — green, 240° arc. End: (8.64, 20.25) */}
      <path d="M16 7.5 A8.5 8.5 0 1 1 8.64 20.25" stroke="#30D158" strokeWidth="2.8" strokeLinecap="round" />
      {/* Stand ring — cyan, 190° arc. End: (15.13, 20.92) */}
      <path d="M16 11 A5 5 0 1 1 15.13 20.92" stroke="#64D2FF" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function FitbitLogo({ size = 28 }: { size?: number }) {
  // 3×3 grid of dots, middle row larger — Fitbit's iconic mark
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="#00B0B9" />
      {/* Top row — small */}
      <circle cx="9.5" cy="9.5" r="1.8" fill="white" opacity="0.6" />
      <circle cx="16" cy="9.5" r="1.8" fill="white" opacity="0.6" />
      <circle cx="22.5" cy="9.5" r="1.8" fill="white" opacity="0.6" />
      {/* Middle row — large (primary) */}
      <circle cx="9.5" cy="16" r="2.5" fill="white" />
      <circle cx="16" cy="16" r="2.5" fill="white" />
      <circle cx="22.5" cy="16" r="2.5" fill="white" />
      {/* Bottom row — small */}
      <circle cx="9.5" cy="22.5" r="1.8" fill="white" opacity="0.6" />
      <circle cx="16" cy="22.5" r="1.8" fill="white" opacity="0.6" />
      <circle cx="22.5" cy="22.5" r="1.8" fill="white" opacity="0.6" />
    </svg>
  );
}

function GoogleHealthLogo({ size = 28 }: { size?: number }) {
  // Two-tone heart: Google Blue (left lobe) + Google Red (right lobe)
  // Clean split at x=16 — immediately readable as Google at any size
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="white" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="#E0E0E0" strokeWidth="0.5" />
      {/* Left lobe — Google Blue. Sweeps from bottom tip up-left, over top, and back to center V */}
      <path d="M16 25 C10 21.5 4.5 17.5 4.5 12.5 C4.5 8.5 7.5 6 11 6 C13.7 6 15.5 7.8 16 9.5 Z" fill="#4285F4" />
      {/* Right lobe — Google Red. Mirror of left */}
      <path d="M16 25 C22 21.5 27.5 17.5 27.5 12.5 C27.5 8.5 24.5 6 21 6 C18.3 6 16.5 7.8 16 9.5 Z" fill="#EA4335" />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Platform Card ─────────────────────────────────────────────────────────────

interface PlatformCardProps {
  platform: PlatformMeta;
  status: IntegrationStatus | null;
  onConnect: (id: PlatformMeta['id']) => void;
  onDisconnect: (id: PlatformMeta['id']) => void;
  onSync: (id: PlatformMeta['id']) => void;
  onPreferenceChange: (id: PlatformMeta['id'], pref: SyncPreference) => void;
  onToggleSync: (id: PlatformMeta['id'], enabled: boolean) => void;
  syncing: boolean;
  connecting: boolean;
  /** When set, card is shown as a child integration — no connect/disconnect buttons */
  parentName?: string;
}

function PlatformCard({
  platform,
  status,
  onConnect,
  onDisconnect,
  onSync,
  onPreferenceChange,
  onToggleSync,
  syncing,
  connecting,
  parentName,
}: PlatformCardProps) {
  const [expanded, setExpanded] = useState(false);
  const connected = status?.connected ?? false;
  const isChild = !!parentName;

  return (
    <div
      className={`glass-card overflow-hidden transition-all duration-200 ${
        platform.comingSoon ? 'opacity-60' : ''
      }`}
    >
      {/* Header */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${platform.bgColor} border ${platform.borderColor}`}
          >
            {platform.icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-text-primary">{platform.name}</h3>
              {platform.comingSoon && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-1 text-text-muted border border-white/10">
                  Coming soon
                </span>
              )}
              {!platform.comingSoon && isChild && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    connected
                      ? 'bg-accent-green/10 text-accent-green border-accent-green/20'
                      : 'bg-surface-1 text-text-muted border-white/10'
                  }`}
                >
                  {connected ? (
                    <><CheckCircle2 className="w-2.5 h-2.5" /> Included with {parentName}</>
                  ) : (
                    <><XCircle className="w-2.5 h-2.5" /> Connect {parentName} above</>
                  )}
                </span>
              )}
              {!platform.comingSoon && !isChild && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    connected
                      ? 'bg-accent-green/10 text-accent-green border-accent-green/20'
                      : 'bg-surface-1 text-text-muted border-white/10'
                  }`}
                >
                  {connected ? (
                    <><CheckCircle2 className="w-2.5 h-2.5" /> Connected</>
                  ) : (
                    <><XCircle className="w-2.5 h-2.5" /> Not connected</>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5">{platform.tagline}</p>

            {connected && status && !isChild && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <Clock className="w-3 h-3" />
                  Synced {relativeTime(status.last_synced_at)}
                </span>
                {status.platform_user_id && (
                  <span className="text-xs text-text-muted">
                    ID: {status.platform_user_id.slice(0, 8)}…
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons — hidden for child integrations */}
          {!platform.comingSoon && !isChild && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {connected && (
                <button
                  onClick={() => onSync(platform.id)}
                  disabled={syncing || !status?.sync_enabled}
                  className="p-2 rounded-xl bg-surface-1 border border-white/10 text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-40"
                  title="Sync now"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                </button>
              )}
              {connected ? (
                <button
                  onClick={() => onDisconnect(platform.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 transition-colors"
                >
                  <Link2Off className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => onConnect(platform.id)}
                  disabled={connecting}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border transition-colors disabled:opacity-50 ${platform.color} border-transparent hover:opacity-90`}
                >
                  {connecting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  Connect
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sync preference — only for primary integrations */}
        {connected && status && !platform.comingSoon && !isChild && (
          <div className="mt-4 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-text-secondary font-medium">Sync mode</span>
              <div className="flex items-center rounded-lg bg-surface-1 border border-white/10 p-0.5 gap-0.5">
                {(['fill_nulls', 'always_override'] as SyncPreference[]).map((pref) => (
                  <button
                    key={pref}
                    onClick={() => onPreferenceChange(platform.id, pref)}
                    className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors ${
                      status.sync_preference === pref
                        ? 'bg-surface-2 text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {pref === 'fill_nulls' ? 'Fill empty only' : 'Always override'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Auto-sync</span>
              <button
                onClick={() => onToggleSync(platform.id, !status.sync_enabled)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ${
                  status.sync_enabled
                    ? 'bg-accent-green border-accent-green/50'
                    : 'bg-surface-1 border-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 mt-0.5 rounded-full bg-white shadow transition-transform duration-200 ${
                    status.sync_enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data fields expandable section */}
      <div className="border-t border-white/5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 sm:px-6 py-3 text-xs text-text-secondary hover:text-text-primary hover:bg-white/2 transition-colors"
        >
          <span className="font-medium">
            Data we pull ({platform.dataFields.filter((f) => f.available).length} fields)
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && (
          <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {platform.dataFields.map((field) => (
              <div
                key={field.key}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${
                  field.available
                    ? 'bg-surface-1/60 border-white/8 text-text-secondary'
                    : 'bg-surface-0/40 border-white/5 text-text-muted opacity-60'
                }`}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 ${
                    field.available ? 'text-accent-green' : 'text-text-muted'
                  }`}
                >
                  {field.available ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-current opacity-60">{field.icon}</span>
                    <span className="text-xs font-medium">{field.label}</span>
                  </div>
                  {field.note && (
                    <p className="text-[10px] text-text-muted mt-0.5 leading-snug">{field.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ConnectedAccountsTab() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [hkAvailable, setHkAvailable] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStatuses = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/integrations/status'), getApiFetchOptions());
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.statuses ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
    isHealthKitAvailable().then(setHkAvailable);

    // Check URL params for OAuth callback results
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'fitbit') {
      showToast('Fitbit connected successfully!', 'success');
      window.history.replaceState({}, '', '/?tab=connected');
    } else if (params.get('error')) {
      const err = params.get('error');
      const msgs: Record<string, string> = {
        fitbit_denied: 'Fitbit connection was cancelled.',
        fitbit_state_mismatch: 'Security check failed. Please try again.',
        fitbit_token_exchange: 'Could not connect to Fitbit. Please try again.',
        fitbit_config: 'Fitbit integration is not configured yet.',
      };
      showToast(msgs[err ?? ''] ?? 'Connection failed. Please try again.', 'error');
      window.history.replaceState({}, '', '/?tab=connected');
    }
  }, [loadStatuses]);

  const getStatus = (id: string): IntegrationStatus | null =>
    statuses.find((s) => s.platform === id) ?? null;

  const handleConnect = async (id: PlatformMeta['id']) => {
    if (id === 'fitbit') {
      window.location.href = apiUrl('/api/integrations/fitbit/connect');
      return;
    }

    if (id === 'apple_health') {
      setConnecting(id);
      try {
        if (!hkAvailable) {
          showToast('Apple Health is only available in the iOS app.', 'error');
          return;
        }
        const granted = await requestHealthKitPermissions();
        if (!granted) {
          showToast('Permission denied. Please enable Health access in iOS Settings.', 'error');
          return;
        }
        // Trigger first sync
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        for (const date of [yesterday, today]) {
          const { readHealthKitDay } = await import('@/lib/integrations/apple-health');
          const payload = await readHealthKitDay(date);
          if (payload) {
            await fetch(apiUrl('/api/integrations/apple-health/sync'), {
              ...getApiFetchOptions({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }),
            });
          }
        }
        await loadStatuses();
        showToast('Apple Health connected and synced!', 'success');
      } catch {
        showToast('Could not connect Apple Health. Please try again.', 'error');
      } finally {
        setConnecting(null);
      }
      return;
    }

    showToast('This integration is coming soon.', 'error');
  };

  const handleDisconnect = async (id: PlatformMeta['id']) => {
    if (!confirm(`Disconnect ${id === 'fitbit' ? 'Fitbit' : 'Apple Health'}? Your existing logged data will not be deleted.`)) return;

    try {
      if (id === 'fitbit') {
        await fetch(apiUrl('/api/integrations/fitbit/disconnect'), getApiFetchOptions({ method: 'DELETE' }));
      } else if (id === 'apple_health') {
        await fetch(apiUrl('/api/integrations/apple-health/sync'), getApiFetchOptions({ method: 'DELETE' }));
      }
      await loadStatuses();
      showToast('Disconnected successfully.', 'success');
    } catch {
      showToast('Could not disconnect. Please try again.', 'error');
    }
  };

  const handleSync = async (id: PlatformMeta['id']) => {
    setSyncing(id);
    try {
      const today = new Date().toISOString().slice(0, 10);

      if (id === 'fitbit') {
        const res = await fetch(
          apiUrl('/api/integrations/fitbit/sync'),
          getApiFetchOptions({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today }) }),
        );
        const data = await res.json();
        if (res.ok) {
          const fieldsCount = data.fields_synced?.length ?? 0;
          showToast(
            fieldsCount > 0
              ? `Synced ${fieldsCount} field${fieldsCount === 1 ? '' : 's'} from Fitbit.`
              : 'Fitbit sync complete — no new data to fill.',
            'success',
          );
        } else {
          showToast(`Fitbit sync failed: ${data.error}`, 'error');
        }
      } else if (id === 'apple_health') {
        if (!hkAvailable) {
          showToast('Apple Health sync is only available in the iOS app.', 'error');
          return;
        }
        const { readHealthKitDay } = await import('@/lib/integrations/apple-health');
        const payload = await readHealthKitDay(today);
        if (payload) {
          const res = await fetch(
            apiUrl('/api/integrations/apple-health/sync'),
            getApiFetchOptions({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
          );
          const data = await res.json();
          if (res.ok) {
            const fieldsCount = data.fields_synced?.length ?? 0;
            showToast(
              fieldsCount > 0
                ? `Synced ${fieldsCount} field${fieldsCount === 1 ? '' : 's'} from Apple Health.`
                : 'Apple Health sync complete — no new data to fill.',
              'success',
            );
          } else {
            showToast('Apple Health sync failed.', 'error');
          }
        } else {
          showToast('No HealthKit data found for today.', 'error');
        }
      }

      await loadStatuses();
    } catch {
      showToast('Sync failed. Please try again.', 'error');
    } finally {
      setSyncing(null);
    }
  };

  const handlePreferenceChange = async (id: PlatformMeta['id'], pref: SyncPreference) => {
    try {
      await fetch(
        apiUrl('/api/integrations/status'),
        getApiFetchOptions({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: id, sync_preference: pref }),
        }),
      );
      setStatuses((prev) =>
        prev.map((s) => (s.platform === id ? { ...s, sync_preference: pref } : s)),
      );
    } catch {
      showToast('Could not update preference.', 'error');
    }
  };

  const handleToggleSync = async (id: PlatformMeta['id'], enabled: boolean) => {
    try {
      await fetch(
        apiUrl('/api/integrations/status'),
        getApiFetchOptions({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: id, sync_enabled: enabled }),
        }),
      );
      setStatuses((prev) =>
        prev.map((s) => (s.platform === id ? { ...s, sync_enabled: enabled } : s)),
      );
    } catch {
      showToast('Could not update sync preference.', 'error');
    }
  };

  const PLATFORMS: PlatformMeta[] = [
    {
      id: 'apple_health',
      name: 'Apple Health',
      tagline: 'Steps, sleep, workouts, water, protein, weight via HealthKit',
      icon: <AppleHealthLogo size={24} />,
      color: 'bg-[#FF375F]',
      bgColor: 'bg-[#FF375F]/10',
      borderColor: 'border-[#FF375F]/20',
      available: hkAvailable,
      authType: 'native',
      dataFields: APPLE_HEALTH_FIELDS,
    },
    {
      id: 'apple_health',
      name: 'Apple Fitness',
      tagline: 'Workout sessions from the Fitness app — type, duration, calories',
      icon: <AppleFitnessLogo size={24} />,
      color: 'bg-[#30D158]',
      bgColor: 'bg-[#30D158]/10',
      borderColor: 'border-[#30D158]/20',
      available: hkAvailable,
      authType: 'native',
      dataFields: APPLE_HEALTH_FIELDS.filter((f) =>
        ['steps', 'workout', 'cardio'].includes(f.key),
      ),
    },
    {
      id: 'fitbit',
      name: 'Fitbit',
      tagline: 'Steps, sleep quality, activities, nutrition, weight via Fitbit API',
      icon: <FitbitLogo size={24} />,
      color: 'bg-[#00B0B9]',
      bgColor: 'bg-[#00B0B9]/10',
      borderColor: 'border-[#00B0B9]/20',
      available: true,
      authType: 'oauth',
      dataFields: FITBIT_FIELDS,
    },
    {
      id: 'google_health',
      name: 'Google Health',
      tagline: 'Android Health Connect — steps, workouts, sleep, hydration',
      icon: <GoogleHealthLogo size={24} />,
      color: 'bg-[#4285F4]',
      bgColor: 'bg-[#4285F4]/10',
      borderColor: 'border-[#4285F4]/20',
      available: false,
      comingSoon: true,
      authType: 'coming_soon',
      dataFields: GOOGLE_FIELDS,
    },
  ];

  // Deduplicate: Apple Health + Apple Workout share the same platform ID.
  // Show them as separate informational cards but manage as one connection.
  const appleStatus = getStatus('apple_health');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-pulse text-text-muted font-medium text-sm">Loading connections…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-accent-green/10 border-accent-green/20 text-accent-green'
              : 'bg-red-400/10 border-red-400/20 text-red-400'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-text-primary">Integrations</h2>
        <p className="text-sm text-text-muted mt-1">
          Link your health devices and apps to auto-fill your daily entries. Only data you&apos;ve
          actually recorded on your device will sync — nothing is fabricated.
        </p>
      </div>

      {/* Info banner */}
      <div className="glass-card p-4 flex items-start gap-3 bg-accent-superjoin-orange/5 border-accent-superjoin-orange/15">
        <Zap className="w-4 h-4 text-accent-superjoin-orange flex-shrink-0 mt-0.5" />
        <div className="text-xs text-text-secondary leading-relaxed">
          <span className="font-semibold text-text-primary">How syncing works: </span>
          Connected sources fill your daily entry automatically. With{' '}
          <span className="font-medium text-text-primary">Fill empty only</span> mode, manually-logged
          data is preserved. Switch to{' '}
          <span className="font-medium text-text-primary">Always override</span> to always prefer
          device data. Home-cooked meals, junk food, and alcohol are manual-only — no device tracks
          these.
        </div>
      </div>

      {/* iOS-only notice (shown on web) */}
      {!hkAvailable && (
        <div className="glass-card p-4 flex items-start gap-3 bg-blue-400/5 border-blue-400/15">
          <Smartphone className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">Apple Health on iOS: </span>
            Open the Superjoin Health OS iOS app and tap &quot;Connect Apple Health&quot; to grant
            HealthKit permissions. Fitbit works on any browser.
          </div>
        </div>
      )}

      {/* Apple — single connection, two cards (Health is primary, Fitness is child) */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Apple</h3>

        {/* Apple Health — primary, manages the connection */}
        <PlatformCard
          platform={PLATFORMS[0]}
          status={appleStatus}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onSync={handleSync}
          onPreferenceChange={handlePreferenceChange}
          onToggleSync={handleToggleSync}
          syncing={syncing === 'apple_health'}
          connecting={connecting === 'apple_health'}
        />

        {/* Apple Fitness — child integration, same connection */}
        <div className="ml-5 relative">
          <div className="absolute left-0 top-3 bottom-3 w-px bg-white/10" />
          <PlatformCard
            platform={PLATFORMS[1]}
            status={appleStatus}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
            onPreferenceChange={handlePreferenceChange}
            onToggleSync={handleToggleSync}
            syncing={false}
            connecting={false}
            parentName="Apple Health"
          />
        </div>
      </div>

      {/* Fitbit */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Fitbit</h3>
        <PlatformCard
          platform={PLATFORMS[2]}
          status={getStatus('fitbit')}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onSync={handleSync}
          onPreferenceChange={handlePreferenceChange}
          onToggleSync={handleToggleSync}
          syncing={syncing === 'fitbit'}
          connecting={connecting === 'fitbit'}
        />
      </div>

      {/* Google Health */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Android</h3>
        <PlatformCard
          platform={PLATFORMS[3]}
          status={null}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onSync={handleSync}
          onPreferenceChange={handlePreferenceChange}
          onToggleSync={handleToggleSync}
          syncing={false}
          connecting={false}
        />
      </div>

      {/* Manual-only fields explainer */}
      <div className="glass-card p-5">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Always logged manually</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { icon: '🍱', label: 'Home-cooked meals', reason: 'No health app tracks cooking at home' },
            { icon: '🍔', label: 'Junk food', reason: 'No device detects food quality' },
            { icon: '🍺', label: 'Alcohol', reason: 'Not tracked by any health platform' },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-surface-1 border border-white/8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{item.icon}</span>
                <span className="text-xs font-medium text-text-primary">{item.label}</span>
              </div>
              <p className="text-[10px] text-text-muted leading-snug">{item.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
