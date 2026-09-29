import React, { useCallback, useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getUnreadCount } from '../api/notificationApi';
import { colors } from '../theme/colors';

const POLL_INTERVAL_MS = 20000;

/**
 * The bell icon + unread badge placed on each role's main dashboard
 * (client, shop, service provider, and the driver's own screen) —
 * previously there was no notification bell anywhere in the app at
 * all, meaning a push notification someone missed while the app was
 * closed was just gone with no way to ever see it again. Polls its own
 * unread count independently (same pattern already used elsewhere in
 * this app — inquiries, orders, pending jobs — rather than a new
 * global state mechanism) and refreshes immediately whenever this
 * screen regains focus, e.g. coming back from the notification list
 * after reading something.
 */
const NotificationBell: React.FC = () => {
  const navigation = useNavigation<any>();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    getUnreadCount()
      .then(setUnreadCount)
      .catch(() => {
        // A failed count fetch shouldn't show an error anywhere on a
        // dashboard — just leave the badge as it was until the next
        // successful poll.
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const intervalId = setInterval(refresh, POLL_INTERVAL_MS);
      return () => clearInterval(intervalId);
    }, [refresh])
  );

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => navigation.navigate('Notifications')}
      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <MaterialCommunityIcons name="bell-outline" size={24} color={colors.textPrimary} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: { padding: 4 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: 'white', fontSize: 9, fontWeight: '700' },
});

export default NotificationBell;
