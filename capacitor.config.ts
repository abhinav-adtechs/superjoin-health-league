import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.superjoin.officehealth',
  appName: 'Superjoin Health OS',
  webDir: 'public',
  server: {
    // iOS WebView loads the deployed app (API routes work same-origin).
    // Override with CAPACITOR_SERVER_URL for local dev (e.g. http://localhost:3003) and set CAPACITOR_CLEARTEXT=true.
    url: process.env.CAPACITOR_SERVER_URL || 'https://superjoin-health-league.vercel.app',
    cleartext: process.env.CAPACITOR_CLEARTEXT === 'true',
  },
};

export default config;
