'use client';

import { Bell, BellOff, Slack, Mail, MessageSquare, Smartphone } from 'lucide-react';

// ── Sub-components ────────────────────────────────────────────────────────────

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

function ComingSoonSection({
  icon,
  iconWrapClass,
  title,
  description,
}: {
  icon: React.ReactNode;
  iconWrapClass: string;
  title: string;
  description: string;
}) {
  return (
    <SectionCard>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 opacity-60 ${iconWrapClass}`}
          >
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-secondary">{title}</h2>
              <ComingSoonBadge />
            </div>
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          </div>
        </div>
        <BellOff className="w-5 h-5 text-text-muted opacity-40" />
      </div>
    </SectionCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationsTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Notifications</h1>
        <p className="text-sm text-text-secondary mt-1">
          Stay on top of your health game. More notification channels will be available soon.
        </p>
      </div>

      <ComingSoonSection
        icon={<Slack className="w-5 h-5 text-[#E01E5A]" />}
        iconWrapClass="bg-[#4A154B]/20 border border-[#4A154B]/30"
        title="Slack"
        description="Channel posts and personal DMs when activity is logged"
      />

      <ComingSoonSection
        icon={<Smartphone className="w-5 h-5 text-accent-superjoin-orange" />}
        iconWrapClass="bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20"
        title="Push Notifications"
        description="iOS and Android native push via Firebase"
      />

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

      <div className="flex items-start gap-2 px-1">
        <Bell className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />
        <p className="text-xs text-text-muted leading-relaxed">
          Notification preferences will apply when these channels launch. Reminder times will use your
          profile timezone.
        </p>
      </div>
    </div>
  );
}
