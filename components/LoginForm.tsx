'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import { UserCircle, ChevronDown } from 'lucide-react';

const ADMIN_EMAIL = 'abhinav@superjoin.ai';
const PIN_LENGTH = 6;

type LoginUser = { id: string; display_name: string; avatar_url: string | null };

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'user' | 'admin'>('user');
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LoginUser | null>(null);
  const [pinDigits, setPinDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/users/list'), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  const pin = pinDigits.join('');
  const setPinDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    if (digit && index < PIN_LENGTH - 1) pinRefs.current[index + 1]?.focus();
  };
  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      const next = [...pinDigits];
      next[index - 1] = '';
      setPinDigits(next);
      pinRefs.current[index - 1]?.focus();
    }
  };
  const handlePinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    const next = [...pinDigits];
    pasted.split('').forEach((d, i) => { next[i] = d; });
    for (let i = pasted.length; i < PIN_LENGTH; i++) next[i] = '';
    setPinDigits(next);
    const focusIdx = Math.min(pasted.length, PIN_LENGTH - 1);
    pinRefs.current[focusIdx]?.focus();
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setMessage({ type: 'error', text: 'Select your name first' });
      return;
    }
    if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
      setMessage({ type: 'error', text: 'Enter a 6-digit PIN' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl('/api/auth/pin-login'), getApiFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedUser.id, pin }),
      }));
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setMessage({ type: 'error', text: data.error || 'Login failed' });
        return;
      }
      // Wait a bit for cookies to be set, then reload to ensure session is available
      await new Promise(resolve => setTimeout(resolve, 100));
      window.location.reload();
    } catch (err) {
      setLoading(false);
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: adminPassword,
      });
      if (error) {
        setLoading(false);
        setMessage({ type: 'error', text: error.message });
        return;
      }
      // Wait a bit for session to be set, then reload
      await new Promise(resolve => setTimeout(resolve, 100));
      window.location.reload();
    } catch (err) {
      setLoading(false);
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 rounded-lg bg-surface-1 border border-white/20">
        <button
          type="button"
          onClick={() => { setMode('user'); setMessage(null); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'user' ? 'bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 text-accent-superjoin-orange shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
        >
          User login
        </button>
        <button
          type="button"
          onClick={() => { setMode('admin'); setMessage(null); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'admin' ? 'bg-accent-superjoin-orange/10 border border-accent-superjoin-orange/20 text-accent-superjoin-orange shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
        >
          Admin
        </button>
      </div>

      {mode === 'user' ? (
        <form onSubmit={handlePinLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Who are you?</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="input-field w-full flex items-center gap-3 text-left"
              >
                {selectedUser ? (
                  <>
                    <img
                      src={resolveAvatarUrl({
                        userId: selectedUser.id,
                        displayName: selectedUser.display_name,
                        avatarUrl: selectedUser.avatar_url,
                      })}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover bg-surface-2"
                    />
                    <span className="font-medium">{selectedUser.display_name}</span>
                  </>
                ) : (
                  <>
                    <UserCircle className="w-5 h-5 text-text-muted" />
                    <span className="text-text-muted">Select your name</span>
                  </>
                )}
                <ChevronDown className={`w-4 h-4 ml-auto text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/20 bg-white shadow-lg max-h-56 overflow-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelectedUser(u); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-1 transition-colors"
                    >
                      <img
                        src={resolveAvatarUrl({
                          userId: u.id,
                          displayName: u.display_name,
                          avatarUrl: u.avatar_url,
                        })}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover bg-surface-2"
                      />
                      <span>{u.display_name}</span>
                    </button>
                  ))}
                  {users.length === 0 && (
                    <div className="px-4 py-3 text-text-muted text-sm">No users yet. Ask admin to set up PINs.</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">6-digit PIN</label>
            <div
              className="flex gap-2 justify-center"
              onPaste={handlePinPaste}
            >
              {pinDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { pinRefs.current[i] = el; }}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setPinDigit(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  className="w-11 h-12 sm:w-12 sm:h-14 text-center text-lg font-mono font-semibold rounded-xl border-2 border-gray-300 bg-white focus:border-accent-superjoin-orange/50 focus:ring-2 focus:ring-accent-superjoin-orange/20 outline-none transition-all"
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full bg-accent-superjoin-orange hover:bg-accent-superjoin-orange/90">
            {loading ? '…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Admin</label>
            <p className="text-sm font-medium text-text-primary py-2 px-3 rounded-lg bg-surface-1 border border-white/20">
              {ADMIN_EMAIL}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full bg-accent-superjoin-orange hover:bg-accent-superjoin-orange/90">
            {loading ? '…' : 'Sign in as Admin'}
          </button>
        </form>
      )}

      {message && (
        <p className={`text-sm ${message.type === 'error' ? 'text-accent-red' : 'text-accent-green'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
