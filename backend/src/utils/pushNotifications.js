const { Expo } = require('expo-server-sdk');

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
      }
    }
  } catch (err) {
    // Never let a notification failure break the caller's actual flow.
    console.warn('[push] sendPushNotifications failed:', err.message);
  }
};

module.exports = { sendPushNotifications };
