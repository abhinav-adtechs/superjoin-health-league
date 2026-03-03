import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.superjoin.officehealth',
  appName: 'Superjoin Health OS',
  webDir: 'public',
  server: {
    // iOS WebView loads the deployed app (API routes work same-origin).
    // Override with CAPACITOR_SERVER_URL for local dev (e.g. http://localhost:3003) and set CAPACITOR_CLEARTEXT=true.
    url: process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003',
    cleartext: process.env.CAPACITOR_CLEARTEXT === 'true',
  },
  plugins: {
    PushNotifications: {
      // Present push alerts, badges and sounds in foreground (iOS)
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#F97316',
      sound: 'beep.wav',
    },
  },
};

export default config;
