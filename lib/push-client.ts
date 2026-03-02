/**
 * Client-side push notification registration via Capacitor.
 * Accesses the PushNotifications plugin through Capacitor's global bridge
 * so no package import is needed at compile time (the plugin is registered natively).
 * Only functional in native iOS/Android builds.
 */

import { apiUrl, getApiFetchOptions } from '@/lib/api';

interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    PushNotifications?: {
      checkPermissions: () => Promise<{ receive: string }>;
      requestPermissions: () => Promise<{ receive: string }>;
      register: () => Promise<void>;
      addListener: (
        event: string,
        handler: (data: unknown) => void,
      ) => Promise<{ remove: () => void }>;
    };
  };
}

function getCapacitor(): CapacitorBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor ?? null;
}

/** Returns true if running inside a Capacitor native app (iOS or Android). */
export function isNativeApp(): boolean {
  return getCapacitor()?.isNativePlatform?.() === true;
}

/** Returns the current platform ('ios' | 'android') or null. */
export function getNativePlatform(): 'ios' | 'android' | null {
  const p = getCapacitor()?.getPlatform?.();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return null;
}

/**
 * Request push permission and register the device token.
 * Sends the token to /api/notifications/push/subscribe.
 * Returns 'granted' | 'denied' | 'unavailable'.
 */
export async function registerForPushNotifications(): Promise<'granted' | 'denied' | 'unavailable'> {
  const cap = getCapacitor();
  const push = cap?.Plugins?.PushNotifications;
  if (!push) return 'unavailable';

  try {
    const platform = getNativePlatform();

    // Check / request permission
    let permStatus = await push.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await push.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return 'denied';

    // Register with OS
    await push.register();

    // Wait for token
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Token timeout')), 10000);

      push.addListener('registration', async (token: unknown) => {
        clearTimeout(timeout);
        const tokenValue = (token as { value?: string })?.value;
        if (tokenValue) {
          try {
            await fetch(apiUrl('/api/notifications/push/subscribe'), {
              ...getApiFetchOptions(),
              method: 'POST',
              body: JSON.stringify({ token: tokenValue, platform: platform || 'ios' }),
            });
          } catch {
            // non-fatal
          }
        }
        resolve();
      });

      push.addListener('registrationError', (err: unknown) => {
        clearTimeout(timeout);
        console.error('[Push] registration error:', err);
        reject(err);
      });
    });

    return 'granted';
  } catch (e) {
    console.error('[Push] registerForPushNotifications error:', e);
    return 'denied';
  }
}
