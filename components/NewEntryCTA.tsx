'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Calendar, Dumbbell, Utensils, Moon, Scale } from 'lucide-react';
import { LogEntryModal, type EntryType } from './LogEntryModal';
import type { Profile } from '@/lib/types';

const ENTRY_OPTIONS: { type: EntryType; label: string; icon: typeof Dumbbell }[] = [
  { type: 'movement', label: 'Log Strength', icon: Dumbbell },
  { type: 'meal_recovery', label: 'Log Food', icon: Utensils },
  { type: 'sleep', label: 'Log Sleep', icon: Moon },
  { type: 'weight', label: 'Log Weight', icon: Scale },
  { type: 'full', label: 'Log full day', icon: Calendar },
];

interface NewEntryCTAProps {
  profile: Profile | null;
  onSuccess: () => void;
}

export function NewEntryCTA({ profile, onSuccess }: NewEntryCTAProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalType, setModalType] = useState<EntryType | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      {modalType && profile && (
        <LogEntryModal
          entryType={modalType}
          profile={profile}
          onClose={() => setModalType(null)}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}
