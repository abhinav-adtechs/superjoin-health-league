/**
 * Firebase Admin push notification helpers.
 * Sends FCM messages to iOS (via APNs bridge) and Android devices.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID    — Firebase project ID
 *   FIREBASE_CLIENT_EMAIL  — Service account email
 *   FIREBASE_PRIVATE_KEY   — Service account private key (with \n newlines)
 */

import type { App } from 'firebase-admin/app';

let _app: App | null = null;

function getFirebaseApp(): App | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) return null;

  if (_app) return _app;

  try {
    // firebase-admin is declared as serverExternalPackage so it won't be bundled.
    // Gracefully return null if it hasn't been installed yet.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initializeApp, getApps, cert } = require('firebase-admin/app');
    const existing = getApps();
    if (existing.length > 0) {
      _app = existing[0];
    } else {
      _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
    return _app;
  } catch {
    return null;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Send a push notification to a single FCM token. Returns true on success. */
export async function sendPushToToken(token: string, payload: PushPayload): Promise<boolean> {
  const app = getFirebaseApp();
  if (!app) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMessaging } = require('firebase-admin/messaging') as { getMessaging: (app: App) => { send: (msg: unknown) => Promise<unknown> } };
    const messaging = getMessaging(app);
    await messaging.send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
      android: {
        notification: { sound: 'default', channelId: 'health_notifications' },
      },
    });
    return true;
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    // Token invalid/unregistered — caller should clean it up
    if (
      err?.code === 'messaging/invalid-registration-token' ||
      err?.code === 'messaging/registration-token-not-registered'
    ) {
      return false;
    }
    console.error('[Push] sendPushToToken error:', e);
    return false;
  }
}

/** Send a push notification to all tokens belonging to a user. */
export async function sendPushToUser(
  tokens: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: string[] }> {
  if (tokens.length === 0) return { sent: 0, failed: [] };

  const results = await Promise.all(tokens.map((t) => sendPushToToken(t, payload)));
  const failed = tokens.filter((_, i) => !results[i]);
  return { sent: results.filter(Boolean).length, failed };
}
