'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronDown, Dumbbell, Utensils, Droplets, Moon, Scale } from 'lucide-react';
import { LogEntryModal, type EntryType } from './LogEntryModal';
import type { Profile } from '@/lib/types';

const ENTRY_OPTIONS: { type: EntryType; label: string; arcLabel: string; icon: typeof Dumbbell }[] = [
  { type: 'movement', label: 'Log Movement', arcLabel: 'Movement', icon: Dumbbell },
  { type: 'meal_recovery', label: 'Log Food', arcLabel: 'Food', icon: Utensils },
  { type: 'hydration', label: 'Log Water', arcLabel: 'Water', icon: Droplets },
  { type: 'sleep', label: 'Log Sleep', arcLabel: 'Sleep', icon: Moon },
  { type: 'weight', label: 'Log Weight', arcLabel: 'Weight', icon: Scale },
];

/** Arc angles (rad): ~150° → ~30° so options sit higher and overlap the tab bar less than a full 180° semicircle. */
function arcAngles(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.PI / 2];
  const start = (5 * Math.PI) / 6;
  const end = Math.PI / 6;
  return Array.from({ length: count }, (_, i) => start - ((start - end) / (count - 1)) * i);
}

interface NewEntryCTAProps {
  profile: Profile | null;
  onSuccess: () => void;
  /** `desktop` — header dropdown. `sidebar` — left nav above tabs (desktop). `mobileDock` — bottom bar FAB + arc (mobile only). */
  placement?: 'desktop' | 'mobileDock' | 'sidebar';
  /** When `placement="sidebar"`, matches desktop sidebar pin state for layout. */
  sidebarPinned?: boolean;
}

function useMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isNative =
        typeof window !== 'undefined' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).Capacitor?.isNativePlatform?.() === true;
      const isMobileViewport = window.matchMedia('(max-width: 639px)').matches;
      setIsMobile(isNative || isMobileViewport);
    };

    checkMobile();
    const mq = window.matchMedia('(max-width: 639px)');
    mq.addEventListener('change', checkMobile);
    return () => mq.removeEventListener('change', checkMobile);
  }, []);

  return isMobile;
}

/** Below modal overlay (9999); above sidebar chrome (z-40). */
const PORTAL_MENU_Z = 5000;

export function NewEntryCTA({ profile, onSuccess, placement = 'desktop', sidebarPinned = true }: NewEntryCTAProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalType, setModalType] = useState<EntryType | null>(null);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const [portalMenuStyle, setPortalMenuStyle] = useState<React.CSSProperties>({});
  const isMobile = useMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (placement === 'mobileDock') {
        if (dropdownRef.current && !dropdownRef.current.contains(t)) setDropdownOpen(false);
        return;
      }
      if (placement === 'desktop' || placement === 'sidebar') {
        if (triggerRef.current?.contains(t)) return;
        if (menuPortalRef.current?.contains(t)) return;
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [placement]);

  useLayoutEffect(() => {
    if (!dropdownOpen || placement === 'mobileDock') return;
    if (placement !== 'desktop' && placement !== 'sidebar') return;

    function update() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (placement === 'sidebar' && !sidebarPinned) {
        setPortalMenuStyle({
          position: 'fixed',
          top: rect.top,
          left: rect.right + 8,
          minWidth: 200,
          zIndex: PORTAL_MENU_Z,
        });
      } else {
        setPortalMenuStyle({
          position: 'fixed',
          top: rect.bottom + 8,
          left: rect.left,
          width: Math.max(rect.width, 200),
          minWidth: 200,
          zIndex: PORTAL_MENU_Z,
        });
      }
    }

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const ro = new ResizeObserver(update);
    if (triggerRef.current) ro.observe(triggerRef.current);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      ro.disconnect();
    };
  }, [dropdownOpen, placement, sidebarPinned]);

  useEffect(() => {
    if (!dropdownOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dropdownOpen]);

  const openModal = (type: EntryType) => {
    setDropdownOpen(false);
    setModalType(type);
  };

  const modal = modalType && profile ? (
    <LogEntryModal
      entryType={modalType}
      profile={profile}
      onClose={() => setModalType(null)}
      onSuccess={onSuccess}
    />
  ) : null;

  const arcRadiusPx = 120;

  const portalDropdown =
    mounted &&
    dropdownOpen &&
    (placement === 'desktop' || placement === 'sidebar') &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuPortalRef}
            style={portalMenuStyle}
            className="rounded-xl border border-slate-300/90 bg-white py-1 shadow-xl shadow-slate-900/15 ring-1 ring-slate-900/10 animate-fade-up"
            role="menu"
          >
            {ENTRY_OPTIONS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                role="menuitem"
                onClick={() => openModal(type)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-text-primary hover:bg-black/5 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <Icon className="w-4 h-4 text-text-muted shrink-0" />
                {label}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  if (placement === 'mobileDock' && mounted && isMobile) {
    const angles = arcAngles(ENTRY_OPTIONS.length);

    return (
      <>
        {/* Backdrop stays in-tree (not portaled) so it stacks under the FAB/arc inside the bottom-nav z-40 context. */}
        <div className="relative flex -translate-y-4 flex-col items-center justify-end bg-transparent pointer-events-none">
          {dropdownOpen && (
            <button
              type="button"
              aria-label="Dismiss log menu"
              className="arc-backdrop-scrim arc-backdrop-enter md:hidden"
              onClick={() => setDropdownOpen(false)}
            />
          )}
          <div ref={dropdownRef} className="pointer-events-auto relative z-[2] flex flex-col items-center overflow-visible bg-transparent">
            {dropdownOpen && (
              <div
                className="absolute bottom-8 left-1/2 z-10 h-0 w-0 -translate-x-1/2 overflow-visible"
                aria-hidden={false}
              >
                {ENTRY_OPTIONS.map(({ type, label, arcLabel, icon: Icon }, i) => {
                  const angle = angles[i] ?? Math.PI / 2;
                  const tx = arcRadiusPx * Math.cos(angle);
                  const ty = -arcRadiusPx * Math.sin(angle);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => openModal(type)}
                      style={
                        {
                          '--arc-tx': `${tx}px`,
                          '--arc-ty': `${ty}px`,
                          animationDelay: `${40 + i * 48}ms`,
                        } as React.CSSProperties
                      }
                      className="arc-menu-glass absolute left-0 top-0 z-[3] flex h-11 min-w-[6.25rem] max-w-[6.75rem] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl px-3 touch-manipulation"
                      title={label}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-accent-superjoin-orange" />
                      <span className="arc-menu-glass-label text-left text-[12px] font-semibold leading-snug">{arcLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className={`relative z-[4] flex h-14 w-14 shrink-0 appearance-none items-center justify-center rounded-full touch-manipulation transition-all duration-200 active:scale-95 mobile-dock-fab-glass ${dropdownOpen ? 'mobile-dock-fab-glass--open' : ''}`}
              aria-label="New Entry"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <Plus
                className={`h-6 w-6 text-accent-superjoin-orange transition-transform duration-300 ease-out ${dropdownOpen ? 'rotate-45' : ''}`}
              />
            </button>
          </div>
        </div>
        {modal}
      </>
    );
  }

  if (placement === 'desktop') {
    return (
      <>
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="btn-primary flex items-center gap-2 shadow-md hover:shadow-lg transition-shadow"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <Plus className="w-4 h-4" />
            <span>New Entry</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {portalDropdown}
        {modal}
      </>
    );
  }

  if (placement === 'sidebar') {
    return (
      <>
        <div className="relative w-full">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className={`btn-primary flex items-center shadow-md hover:shadow-lg transition-shadow w-full ${
              sidebarPinned
                ? 'justify-center gap-2 px-3 py-2.5'
                : 'justify-center gap-0 px-2 py-2.5 group-hover:justify-start group-hover:gap-2 group-hover:px-3'
            }`}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            title="New entry"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span
              className={`text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                sidebarPinned
                  ? 'opacity-100'
                  : 'max-w-0 overflow-hidden opacity-0 group-hover:max-w-[min(14rem,70vw)] group-hover:opacity-100'
              }`}
            >
              New Entry
            </span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''} ${
                sidebarPinned
                  ? 'opacity-100'
                  : 'max-w-0 overflow-hidden opacity-0 group-hover:max-w-[min(2rem,20vw)] group-hover:opacity-100'
              }`}
            />
          </button>
        </div>
        {portalDropdown}
        {modal}
      </>
    );
  }

  return null;
}
