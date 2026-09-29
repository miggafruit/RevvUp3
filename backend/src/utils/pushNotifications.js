const { Expo } = require('expo-server-sdk');
const { reportSilentFailure } = require('./reportSilentFailure');
const Notification = require('../models/Notification');

const expo = new Expo();

/**
 * Sends a push notification to one or more users, given their User
 * documents (or push tokens directly), AND persists an in-app
 * notification record for each recipient — this is the single choke
 * point almost every part of the app already calls through to send a
 * push, so hooking notification history in here means every existing
 * call site (new orders, KYC review, inquiries, ride events, etc.)
 * gets a real notification bell/history for free, with no per-call-
 * site changes needed. Silently skips anyone without a registered
 * push token for the push itself, but still records the in-app
 * notification regardless — someone without a token yet should still
 * see it next time they open the app, not just miss it entirely.
 *
 * This never throws — a failed push or a failed notification write
 * should never break the actual request/accept/complete flow it's
 * attached to. Errors are logged and swallowed (via
 * reportSilentFailure, so a systemic issue still surfaces in Sentry).
 */
const sendPushNotifications = async (recipients, { title, body, data }) => {
  // Recipients without a real _id (a raw token string, if that path is
  // ever actually used) can't be tied to an in-app notification —
  // every real call site in this codebase passes full User documents,
  // so this only ever filters out something in a hypothetical future
  // call site, not real cases today.
  const recipientIds = recipients.map((r) => (typeof r === 'string' ? null : r?._id)).filter(Boolean);

  if (recipientIds.length > 0) {
    try {
      await Notification.insertMany(
        recipientIds.map((recipient) => ({
          recipient,
          title,
          body,
          type: data?.type || 'general',
          data: data || {}
        }))
      );
    } catch (err) {
      console.warn('[notifications] Failed to persist notification record(s):', err.message);
      reportSilentFailure(err, 'notifications', { notificationType: data?.type, recipientCount: recipientIds.length });
    }
  }

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
