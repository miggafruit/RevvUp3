import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useEHailingSocketConnection } from '../context/EHailingSocketContext';
import { useAuth } from '../context/AuthContext';

/**
 * The socket connection state (isConnected) was already tracked in
 * EHailingSocketContext, but nothing anywhere in the app ever
 * displayed it — meaning a dropped real-time connection during an
 * active tow/delivery was completely invisible to the person relying
 * on it. This renders a small banner only after being disconnected
 * for a bit (avoids flashing on normal brief blips — elevators,
 * tunnels, a few seconds of bad signal are normal and self-recover),
 * and only while the connection is actually down. socket.io keeps
 * retrying underneath automatically; this is purely about the person
 * knowing that's happening instead of trusting a screen that's quietly
 * gone stale.
 */
const RECONNECT_GRACE_MS = 4000;

const ConnectionStatusBanner: React.FC = () => {
  const { isConnected } = useEHailingSocketConnection();
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // No user = no socket is ever attempted at all (see
    // EHailingSocketContext), so isConnected is permanently false
    // before login — without this check the banner would incorrectly
    // show on the login/register screens every single time.
    if (!user || isConnected) {
      setShowBanner(false);
      return;
    }
    const timer = setTimeout(() => setShowBanner(true), RECONNECT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [user, isConnected]);

  if (!showBanner) return null;

  return (
    <View style={styles.banner} pointerEvents="none">
      <Text style={styles.text}>Reconnecting… some updates may be delayed</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#B45309',
    paddingVertical: 6,
    alignItems: 'center',
    zIndex: 999
  },
  text: { color: 'white', fontSize: 12, fontWeight: '600' }
});

export default ConnectionStatusBanner;
