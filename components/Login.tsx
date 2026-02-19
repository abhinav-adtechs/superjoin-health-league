import React, { useState } from 'react';
import { auth, Admin } from '../services/auth';
import { Lock, LogIn, LogOut, User, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';

interface LoginProps {
  currentAdmin: Admin | null;
  onLogin: (admin: Admin) => void;
  onLogout: () => void;
}

export const Login: React.FC<LoginProps> = ({ currentAdmin, onLogin, onLogout }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await auth.login(password);
    setLoading(false);
    if (result.success && result.admin) {
      onLogin(result.admin);
      setPassword('');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const handleLogout = () => {
    auth.logout();
    onLogout();
  };

  if (currentAdmin) {
    return (
      <div className="glass-card overflow-hidden">
        {/* Top accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-accent-green/40 to-transparent"></div>
        
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-accent-green" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Admin Session</h3>
                <p className="text-[11px] text-text-muted">You have full access</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-ghost flex items-center gap-2 text-sm text-accent-red border-accent-red/20 hover:bg-accent-red/10 w-full sm:w-auto justify-center"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>

          {/* Admin Profile */}
          <div className="p-4 rounded-xl bg-glass-light border border-glass-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-green/20 to-accent-purple/20 border border-glass-border flex items-center justify-center">
                <User className="w-6 h-6 text-accent-green" />
              </div>
              <div>
                <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Logged in as</div>
                <div className="text-lg font-bold text-text-primary">{currentAdmin.name}</div>
              </div>
            </div>
          </div>

          {/* Access Badge */}
          <div className="mt-4 p-3 rounded-xl bg-accent-green/5 border border-accent-green/10 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent-green shrink-0" />
            <div>
              <div className="text-xs font-semibold text-accent-green">Admin Access Active</div>
              <div className="text-[10px] text-text-muted mt-0.5">
                You can log activity, manage participants, and modify resources.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="glass-card overflow-hidden">
        {/* Top accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-accent-purple/40 to-transparent"></div>

        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-accent-purple" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Admin Login</h3>
              <p className="text-[11px] text-text-muted">Enter your password to continue</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password..."
                className="input-field"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-accent-red/8 border border-accent-red/15 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-accent-red shrink-0" />
                <span className="text-xs font-medium text-accent-red">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>

          <div className="mt-5 p-3 rounded-xl bg-glass-light border border-glass-border">
            <p className="text-[11px] text-text-muted leading-relaxed">
              <span className="font-semibold text-text-secondary">Note:</span> Viewing is not restricted. Only admin actions require authentication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
