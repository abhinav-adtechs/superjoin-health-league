'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  BellOff,
  Slack,
  Mail,
  MessageSquare,
  Smartphone,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Link2,
  Clock,
} from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { isNativeApp, registerForPushNotifications } from '@/lib/push-client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationPrefs {
  slack_enabled: boolean;
  slack_email: string | null;
  slack_channel_post_enabled: boolean;
  slack_dm_enabled: boolean;
  slack_reminder_enabled: boolean;
  slack_reminder_time: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;
  push_on_entry_enabled: boolean;
  push_reminder_enabled: boolean;
  push_reminder_time: string;
}

const DEFAULTS: NotificationPrefs = {
  slack_enabled: false,
  slack_email: null,
  slack_channel_post_enabled: true,
  slack_dm_enabled: false,
  slack_reminder_enabled: false,
  slack_reminder_time: '09:00',
  email_enabled: false,
  whatsapp_enabled: false,
  push_enabled: false,
  push_on_entry_enabled: true,
  push_reminder_enabled: false,
  push_reminder_time: '09:00',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-superjoin-orange/50 ${
        checked ? 'bg-accent-superjoin-orange' : 'bg-surface-2'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-card p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2 border border-white/10 text-text-muted uppercase tracking-wide">
      Coming Soon
    </span>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0 mt-0.5">
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Slack link state
  const [slackEmail, setSlackEmail] = useState('');
  const [slackLinking, setSlackLinking] = useState(false);
  const [slackLinkError, setSlackLinkError] = useState<string | null>(null);
  const [slackLinked, setSlackLinked] = useState(false);

  // Push registration state
  const [pushRegistering, setPushRegistering] = useState(false);
  const [pushRegError, setPushRegError] = useState<string | null>(null);
  const [nativeApp] = useState(() => isNativeApp());

  // Expand/collapse sections
  const [slackExpanded, setSlackExpanded] = useState(true);
  const [pushExpanded, setPushExpanded] = useState(true);

  // ── Load prefs ─────────────────────────────────────────────────────────────

  const loadPrefs = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/notifications/preferences'), getApiFetchOptions());
      if (res.ok) {
        const data = await res.json();
        setPrefs({ ...DEFAULTS, ...data });
        if (data.slack_email) {
          setSlackEmail(data.slack_email);
          setSlackLinked(true);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  // ── Save prefs ─────────────────────────────────────────────────────────────

  const savePrefs = async (updates: Partial<NotificationPrefs>) => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const next = { ...prefs, ...updates };
    setPrefs(next);

    try {
      const res = await fetch(apiUrl('/api/notifications/preferences'), {
        ...getApiFetchOptions(),
        method: 'POST',
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error || 'Failed to save');
        setPrefs(prefs); // rollback
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {
      setSaveError('Network error');
      setPrefs(prefs); // rollback
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof NotificationPrefs, value: unknown) => {
    savePrefs({ [field]: value } as Partial<NotificationPrefs>);
  };

  // ── Push toggle (triggers native permission request) ───────────────────────

  const handlePushToggle = async (enabled: boolean) => {
    setPushRegError(null);
    if (enabled && nativeApp) {
      setPushRegistering(true);
      const result = await registerForPushNotifications();
      setPushRegistering(false);
      if (result === 'denied') {
        setPushRegError('Push permission denied. Please enable notifications in your device settings.');
        return;
      }
      if (result === 'unavailable') {
        setPushRegError('Push notifications are only available in the iOS/Android app.');
        return;
      }
    }
    update('push_enabled', enabled);
  };

  // ── Slack user link ────────────────────────────────────────────────────────

  const linkSlackUser = async () => {
    if (!slackEmail.trim()) return;
    setSlackLinking(true);
    setSlackLinkError(null);

    try {
      const res = await fetch(apiUrl('/api/notifications/slack/link-user'), {
        ...getApiFetchOptions(),
        method: 'POST',
        body: JSON.stringify({ email: slackEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSlackLinkError(data.error || 'Failed to link');
      } else {
        setSlackLinked(true);
        // Also save the email in prefs
        await savePrefs({ slack_email: slackEmail.trim() });
      }
    } catch {
      setSlackLinkError('Network error');
    } finally {
      setSlackLinking(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">Notifications</h1>
        <p className="text-sm text-text-secondary mt-1">
          Stay on top of your health game. Get notified when you or your teammates log activity,
          and set daily reminders so you never miss a day.
        </p>
      </div>

      {/* Status bar */}
      {(saving || saveSuccess || saveError) && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border ${
            saveError
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : saveSuccess
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-surface-1 border-white/10 text-text-muted'
          }`}
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saveSuccess && <Check className="w-3.5 h-3.5" />}
          {saveError && <AlertCircle className="w-3.5 h-3.5" />}
          <span>
            {saving ? 'Saving…' : saveSuccess ? 'Saved!' : saveError}
          </span>
        </div>
      )}

      {/* ── SLACK ── */}
      <SectionCard>
        {/* Section header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#4A154B]/20 border border-[#4A154B]/30 flex items-center justify-center shrink-0">
              <Slack className="w-5 h-5 text-[#E01E5A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-primary">Slack</h2>
                {prefs.slack_enabled && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Channel posts &amp; personal DMs when activity is logged
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Toggle
              checked={prefs.slack_enabled}
              onChange={(v) => update('slack_enabled', v)}
            />
            <button
              onClick={() => setSlackExpanded((p) => !p)}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              {slackExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {slackExpanded && (
          <div className="mt-4 space-y-4">
            {/* Link Slack account */}
            <div className="p-4 rounded-xl bg-surface-1 border border-white/8">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  Link your Slack account
                </p>
              </div>
              <p className="text-xs text-text-muted mb-3">
                Enter the email you use in Slack. We&apos;ll look up your account so we can send DMs.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={slackEmail}
                  onChange={(e) => { setSlackEmail(e.target.value); setSlackLinked(false); setSlackLinkError(null); }}
                  placeholder="you@company.com"
                  className="flex-1 px-3 py-2 text-sm bg-surface-0 border border-white/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-superjoin-orange/40"
                  disabled={!prefs.slack_enabled}
                />
                <button
                  onClick={linkSlackUser}
                  disabled={!prefs.slack_enabled || !slackEmail.trim() || slackLinking}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-superjoin-orange text-white hover:bg-accent-superjoin-orange/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {slackLinking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : slackLinked ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  {slackLinked ? 'Linked' : 'Link'}
                </button>
              </div>
              {slackLinkError && (
                <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {slackLinkError}
                </p>
              )}
              {slackLinked && (
                <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3 shrink-0" /> Slack account linked successfully
                </p>
              )}
            </div>

            {/* Notification options */}
            <div className="divide-y divide-white/5">
              <SettingRow
                label="Post to channel"
                description="Share a rich message in your Slack workspace channel when you log an activity. Includes entry type, points, and a graphic."
                checked={prefs.slack_channel_post_enabled}
                onChange={(v) => update('slack_channel_post_enabled', v)}
                disabled={!prefs.slack_enabled}
              />
              <SettingRow
                label="Send me a DM"
                description="Receive a personal Slack DM whenever you log an activity. Requires your Slack account to be linked above."
                checked={prefs.slack_dm_enabled}
                onChange={(v) => update('slack_dm_enabled', v)}
                disabled={!prefs.slack_enabled || !slackLinked}
              />
              <SettingRow
                label="Daily reminder"
                description="Get a Slack DM reminder at your chosen time if you haven't logged yet. Sent in your local timezone."
                checked={prefs.slack_reminder_enabled}
                onChange={(v) => update('slack_reminder_enabled', v)}
                disabled={!prefs.slack_enabled || !slackLinked}
              />
            </div>

            {/* Reminder time picker */}
            {prefs.slack_enabled && prefs.slack_dm_enabled && prefs.slack_reminder_enabled && slackLinked && (
              <div className="flex items-center gap-3 pt-1">
                <Clock className="w-4 h-4 text-text-muted shrink-0" />
                <label className="text-sm text-text-secondary">Reminder time</label>
                <input
                  type="time"
                  value={prefs.slack_reminder_time}
                  onChange={(e) => update('slack_reminder_time', e.target.value)}
                  className="ml-auto px-3 py-1.5 text-sm bg-surface-1 border border-white/10 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-superjoin-orange/40"
                />
              </div>
            )}

            {/* Setup instructions */}
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs text-text-muted leading-relaxed">
              <p className="font-semibold text-text-secondary mb-1">How to set up Slack</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Ask your admin to configure <code className="px-1 rounded bg-surface-1 text-text-primary">SLACK_BOT_TOKEN</code> and <code className="px-1 rounded bg-surface-1 text-text-primary">SLACK_WEBHOOK_URL</code> in the app settings</li>
                <li>Create a Slack App at <span className="text-blue-400">api.slack.com</span> with scopes: <code className="px-1 rounded bg-surface-1 text-text-primary">chat:write</code>, <code className="px-1 rounded bg-surface-1 text-text-primary">users:read.email</code>, <code className="px-1 rounded bg-surface-1 text-text-primary">im:write</code></li>
                <li>Link your Slack account above using your workspace email</li>
              </ol>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── PUSH NOTIFICATIONS ── */}
      <SectionCard>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-accent-superjoin-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-primary">Push Notifications</h2>
                {prefs.push_enabled && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                iOS &amp; Android native push via Firebase
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pushRegistering ? (
              <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
            ) : (
              <Toggle
                checked={prefs.push_enabled}
                onChange={handlePushToggle}
              />
            )}
            <button
              onClick={() => setPushExpanded((p) => !p)}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              {pushExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {pushExpanded && (
          <div className="mt-4 space-y-4">
            {pushRegError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pushRegError}</span>
              </div>
            )}
            {!nativeApp && prefs.push_enabled && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Push notifications only work in the iOS/Android app. Preferences will be saved for when you use the mobile app.</span>
              </div>
            )}
            <div className="divide-y divide-white/5">
              <SettingRow
                label="On activity logged"
                description="Receive a push notification when you log a health entry. Great for confirming your log went through."
                checked={prefs.push_on_entry_enabled}
                onChange={(v) => update('push_on_entry_enabled', v)}
                disabled={!prefs.push_enabled}
              />
              <SettingRow
                label="Daily reminder"
                description="Get a push notification at your chosen time each day reminding you to log your health activities."
                checked={prefs.push_reminder_enabled}
                onChange={(v) => update('push_reminder_enabled', v)}
                disabled={!prefs.push_enabled}
              />
            </div>

            {/* Push reminder time */}
            {prefs.push_enabled && prefs.push_reminder_enabled && (
              <div className="flex items-center gap-3 pt-1">
                <Clock className="w-4 h-4 text-text-muted shrink-0" />
                <label className="text-sm text-text-secondary">Reminder time</label>
                <input
                  type="time"
                  value={prefs.push_reminder_time}
                  onChange={(e) => update('push_reminder_time', e.target.value)}
                  className="ml-auto px-3 py-1.5 text-sm bg-surface-1 border border-white/10 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-superjoin-orange/40"
                />
              </div>
            )}

            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs text-text-muted leading-relaxed">
              <p className="font-semibold text-text-secondary mb-1">How push notifications work</p>
              <p>
                Push notifications require the iOS or Android app. On first toggle, the app will request
                permission and register your device. Make sure you&apos;re using the Superjoin Health OS
                mobile app.
              </p>
              <p className="mt-1.5">
                Admin setup requires <code className="px-1 rounded bg-surface-1 text-text-primary">FIREBASE_PROJECT_ID</code>,{' '}
                <code className="px-1 rounded bg-surface-1 text-text-primary">FIREBASE_CLIENT_EMAIL</code>, and{' '}
                <code className="px-1 rounded bg-surface-1 text-text-primary">FIREBASE_PRIVATE_KEY</code> env vars.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── EMAIL — Coming Soon ── */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 opacity-60">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-secondary">Email Notifications</h2>
                <ComingSoonBadge />
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Weekly digest, streak alerts, and leaderboard updates
              </p>
            </div>
          </div>
          <BellOff className="w-5 h-5 text-text-muted opacity-40" />
        </div>
      </SectionCard>

      {/* ── WHATSAPP — Coming Soon ── */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 opacity-60">
              <MessageSquare className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-secondary">WhatsApp Notifications</h2>
                <ComingSoonBadge />
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Activity updates and reminders via WhatsApp Business API
              </p>
            </div>
          </div>
          <BellOff className="w-5 h-5 text-text-muted opacity-40" />
        </div>
      </SectionCard>

      {/* Bottom hint */}
      <div className="flex items-start gap-2 px-1">
        <Bell className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />
        <p className="text-xs text-text-muted leading-relaxed">
          Changes are saved instantly. Reminder times are interpreted in your profile&apos;s local timezone.
          Channel posts appear in the Slack workspace configured by your admin.
        </p>
      </div>
    </div>
  );
}
