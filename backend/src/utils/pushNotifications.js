const { Expo } = require('expo-server-sdk');
const { reportSilentFailure } = require('./reportSilentFailure');

const expo = new Expo();

/**
 * Sends a push notification to one or more users, given their User
 * documents (or push tokens directly). Silently skips anyone without a
 * registered token — most users won't have one until they've opened
 * the app at least once with notifications enabled, and that's fine,
 * not an error condition.
 *
 * This never throws — a failed push notification should never break
 * the actual request/accept/complete flow it's attached to. Errors are
 * logged and swallowed.
 */
const sendPushNotifications = async (recipients, { title, body, data }) => {
  try {
    const tokens = recipients
      .map((r) => (typeof r === 'string' ? r : r?.pushToken))
      .filter((token) => token && Expo.isExpoPushToken(token));

    if (tokens.length === 0) return;

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {}
    }));

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.warn('[push] Failed to send a chunk of notifications:', err.message);
        // One-off failures here are normal (a stale token, a brief
        // Expo API hiccup) — reported anyway so a systemic issue
        // (e.g. Expo access token misconfigured, mass token
        // invalidation) shows up as a cluster of events instead of
        // being invisible until "nobody's getting notifications" turns
        // into a support ticket.
        reportSilentFailure(err, 'push-notifications', { notificationType: data?.type, chunkSize: chunk.length });
      }
    }
  } catch (err) {
    // Never let a notification failure break the caller's actual flow.
    console.warn('[push] sendPushNotifications failed:', err.message);
    reportSilentFailure(err, 'push-notifications', { notificationType: data?.type });
  }
};

module.exports = { sendPushNotifications };
