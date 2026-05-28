'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface EntryModalHeaderProps {
  title: string;
  onClose: () => void;
  /** Full-width row below title (e.g. compact date picker for food/water). */
  accessory?: ReactNode;
}

export function EntryModalHeader({ title, onClose, accessory }: EntryModalHeaderProps) {
  return (
    <div className="entry-modal-header sticky top-0 z-10 bg-white border-b border-black/5 rounded-t-2xl px-4 sm:px-5 py-2.5 sm:py-3 edge-safe-top shrink-0">
      <div className="entry-modal-header__row">
        <h2 className="entry-modal-header__title">{title}</h2>
        <button type="button" onClick={onClose} className="entry-modal-header__close" aria-label="Close">
          <X className="w-5 h-5" aria-hidden />
        </button>
      </div>
      {accessory ? <div className="entry-modal-header__accessory">{accessory}</div> : null}
    </div>
  );
}
