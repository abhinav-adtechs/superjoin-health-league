'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronDown, Dumbbell, Utensils, Moon, Scale } from 'lucide-react';
import { LogEntryModal, type EntryType } from './LogEntryModal';
import type { Profile } from '@/lib/types';

const ENTRY_OPTIONS: { type: EntryType; label: string; icon: typeof Dumbbell }[] = [
  { type: 'movement', label: 'Log Movement', icon: Dumbbell },
  { type: 'meal_recovery', label: 'Log Food', icon: Utensils },
  { type: 'sleep', label: 'Log Sleep', icon: Moon },
  { type: 'weight', label: 'Log Weight', icon: Scale },
];

interface NewEntryCTAProps {
  profile: Profile | null;
  onSuccess: () => void;
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

export function NewEntryCTA({ profile, onSuccess }: NewEntryCTAProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalType, setModalType] = useState<EntryType | null>(null);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  if (isMobile && mounted) {
    const fab = (
      <>
        <div className="fixed right-5 z-50 mobile-fab-offset" ref={dropdownRef}>
          {dropdownOpen && (
            <div className="absolute bottom-full right-0 mb-3 min-w-[200px] rounded-xl border border-white/10 bg-white shadow-xl py-1 z-50 animate-fade-up">
              {ENTRY_OPTIONS.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => openModal(type)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-text-primary hover:bg-black/5 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <Icon className="w-4 h-4 text-text-muted shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-14 h-14 rounded-full bg-accent-superjoin-orange flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all touch-manipulation"
            aria-label="New Entry"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <Plus
              className={`w-6 h-6 text-white transition-transform duration-200 ${dropdownOpen ? 'rotate-45' : ''}`}
            />
          </button>
        </div>
        {modal}
      </>
    );

    return createPortal(fab, document.body);
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
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
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-2 min-w-[200px] rounded-xl border border-white/10 bg-white shadow-lg py-1 z-50 animate-fade-up">
            {ENTRY_OPTIONS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => openModal(type)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-text-primary hover:bg-black/5 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <Icon className="w-4 h-4 text-text-muted shrink-0" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {modal}
    </>
  );
}
