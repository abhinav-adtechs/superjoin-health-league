'use client';

import { useEffect } from 'react';
import { Heart } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-1">
      <div className="glass-card p-8 max-w-md mx-4 text-center">
        <div className="w-16 h-16 rounded-xl bg-accent-red/10 border border-accent-red/20 flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 text-accent-red" />
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h1>
        <p className="text-sm text-text-secondary mb-6">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="btn-primary w-full"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
