'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { Plus, ChevronDown, Dumbbell, Utensils, Droplets, Moon, Scale } from 'lucide-react';
import type { EntryType, LogEntryModalProps } from './LogEntryModal';
import type { Profile } from '@/lib/types';

const LogEntryModal = dynamic<LogEntryModalProps>(
  () => import('./LogEntryModal').then((mod) => mod.LogEntryModal),
  { ssr: false },
);

const ENTRY_OPTIONS: { type: EntryType; label: string; shortLabel: string; icon: typeof Dumbbell }[] = [
  { type: 'movement', label: 'Log Movement', shortLabel: 'Movement', icon: Dumbbell },
  { type: 'meal_recovery', label: 'Log Food', shortLabel: 'Food', icon: Utensils },
  { type: 'hydration', label: 'Log Water', shortLabel: 'Water', icon: Droplets },
  { type: 'sleep', label: 'Log Sleep', shortLabel: 'Sleep', icon: Moon },
  { type: 'weight', label: 'Log Weight', shortLabel: 'Weight', icon: Scale },
];

interface NewEntryCTAProps {
  profile: Profile | null;
  onSuccess: () => void;
  /** `desktop` — header dropdown. `sidebar` — left nav above tabs (desktop). `mobileDock` — bottom bar FAB + sheet (mobile only). */
  placement?: 'desktop' | 'mobileDock' | 'sidebar';
  /** When `placement="sidebar"`, matches desktop sidebar pin state for layout. */
  sidebarPinned?: boolean;
}

/** Matches Tailwind `md` (768px): same band as bottom nav (`md:hidden`) vs sidebar (`md:flex`). */
const MOBILE_DOCK_MQ = '(max-width: 767px)';

function useMobileDockViewport() {
  const [showMobileDock, setShowMobileDock] = useState(false);

  useEffect(() => {
    const check = () => {
      const isNative =
        typeof window !== 'undefined' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).Capacitor?.isNativePlatform?.() === true;
      setShowMobileDock(isNative || window.matchMedia(MOBILE_DOCK_MQ).matches);
    };

    check();
    const mq = window.matchMedia(MOBILE_DOCK_MQ);
    mq.addEventListener('change', check);
    return () => mq.removeEventListener('change', check);
  }, []);

  return showMobileDock;
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
  const showMobileDock = useMobileDockViewport();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!dropdownOpen || placement !== 'mobileDock') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dropdownOpen, placement]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (placement === 'mobileDock') return;
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

  const mobileEntrySheet =
    mounted &&
    dropdownOpen &&
    placement === 'mobileDock' &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            className="new-entry-sheet-overlay new-entry-sheet-overlay--enter"
            role="presentation"
            onClick={() => setDropdownOpen(false)}
          >
            <div
              ref={dropdownRef}
              className="new-entry-sheet-card new-entry-sheet-card--enter"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-entry-sheet-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="new-entry-sheet-handle" aria-hidden />
              <h2 id="new-entry-sheet-title" className="new-entry-sheet-title">
                What do you want to log?
              </h2>
              <div className="new-entry-sheet-grid">
                {ENTRY_OPTIONS.map(({ type, label, shortLabel, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => openModal(type)}
                    className="new-entry-sheet-option touch-manipulation"
                  >
                    <span className="new-entry-sheet-option__icon" aria-hidden>
                      <Icon className="h-5 w-5 text-accent-superjoin-orange" strokeWidth={2.25} />
                    </span>
                    <span className="new-entry-sheet-option__label">{shortLabel}</span>
                    <span className="new-entry-sheet-option__hint">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (placement === 'mobileDock' && mounted && showMobileDock) {
    return (
      <>
        <div className="relative flex -translate-y-4 flex-col items-center justify-end bg-transparent">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className={`relative z-[2] flex h-14 w-14 shrink-0 appearance-none items-center justify-center rounded-full touch-manipulation transition-all duration-200 active:scale-95 mobile-dock-fab-glass ${dropdownOpen ? 'mobile-dock-fab-glass--open' : ''}`}
            aria-label="New Entry"
            aria-expanded={dropdownOpen}
            aria-haspopup="dialog"
          >
            <Plus
              className={`h-6 w-6 text-accent-superjoin-orange transition-transform duration-300 ease-out ${dropdownOpen ? 'rotate-45' : ''}`}
            />
          </button>
        </div>
        {mobileEntrySheet}
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
