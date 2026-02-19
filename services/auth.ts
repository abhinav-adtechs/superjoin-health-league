import { supabase } from './supabaseClient';

export interface Admin {
  id: string;
  name: string;
}

export interface LoginAuditEntry {
  id: number;
  admin_id: string | null;
  admin_name_snapshot: string;
  login_at: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
}

const AUTH_STORAGE_KEY = 'office_health_admin_auth';

export const auth = {
  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return false;
    try {
      const data = JSON.parse(stored);
      // Check if session is still valid (24 hours)
      if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  // Get current admin
  getCurrentAdmin: (): Admin | null => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    try {
      const data = JSON.parse(stored);
      if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      return data.admin;
    } catch {
      return null;
    }
  },

  // Login with password
  login: async (password: string): Promise<{ success: boolean; admin?: Admin; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      // Use RPC function to verify password
      const { data: adminData, error: rpcError } = await supabase
        .rpc('verify_admin_password', { plain_password: password });

      // Get IP and user agent for audit
      const ipAddress = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => null);
      const userAgent = navigator.userAgent;

      if (rpcError || !adminData || adminData.length === 0) {
        // Log failed login attempt
        await supabase.from('admin_login_audit').insert({
          admin_id: null,
          admin_name_snapshot: 'UNKNOWN',
          success: false,
          ip_address: ipAddress,
          user_agent: userAgent
        });

        return { success: false, error: 'Invalid password' };
      }

      const matchedAdmin: Admin = {
        id: adminData[0].id,
        name: adminData[0].name
      };

      // Log successful login
      await supabase.from('admin_login_audit').insert({
        admin_id: matchedAdmin.id,
        admin_name_snapshot: matchedAdmin.name,
        success: true,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      // Update last_used_at
      await supabase
        .from('admin_passwords')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', matchedAdmin.id);

      // Store session
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        admin: matchedAdmin,
        timestamp: Date.now()
      }));

      return { success: true, admin: matchedAdmin };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  },

  // Logout
  logout: (): void => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  // Get login audit entries
  getLoginAudit: async (limit: number = 100): Promise<LoginAuditEntry[]> => {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('admin_login_audit')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Audit query error:', error);
        return [];
      }

      return (data || []) as LoginAuditEntry[];
    } catch (error) {
      console.error('Get audit error:', error);
      return [];
    }
  }
};
