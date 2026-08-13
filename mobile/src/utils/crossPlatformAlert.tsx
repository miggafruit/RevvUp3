import React, { useState } from 'react';
import { Platform, Alert as NativeAlert, View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

type ShowFn = (title: string, message?: string, buttons?: AlertButton[]) => void;

// Set once by AlertHost when it mounts. Calling showAlert before that
// (shouldn't happen in practice, AlertHost mounts at the app root) is
// a silent no-op rather than a crash.
let registeredShow: ShowFn | null = null;

/**
 * Drop-in replacement for Alert.alert(title, message, buttons) — same
 * signature, so existing call sites can switch to this by changing
 * only the import. On native, passes straight through to the real
 * Alert.alert (which works fine there). On web, routes to AlertHost's
 * own fully-controlled modal instead of relying on react-native-web's
 * incomplete Alert mapping.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    NativeAlert.alert(title, message, buttons as any);
    return;
  }
  if (registeredShow) {
    registeredShow(title, message, buttons);
  } else {
    // Fallback so a request never silently vanishes even in the
    // unlikely case AlertHost isn't mounted yet.
    // eslint-disable-next-line no-console
    console.warn('[showAlert] AlertHost not mounted yet:', title, message);
  }
}

interface QueuedAlert {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

/**
 * Mount exactly once, at the app root (see App.tsx). Renders the
 * actual modal UI for showAlert() calls on web.
 */
export const AlertHost: React.FC = () => {
  const [current, setCurrent] = useState<QueuedAlert | null>(null);

  React.useEffect(() => {
    registeredShow = (title, message, buttons) => {
      setCurrent({ title, message, buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }] });
    };
    return () => {
      registeredShow = null;
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  const handlePress = (button: AlertButton) => {
    setCurrent(null);
    button.onPress?.();
  };

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => setCurrent(null)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{current?.title}</Text>
          {current?.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <View style={styles.buttonRow}>
            {current?.buttons.map((button, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.button,
                  button.style === 'destructive' && styles.buttonDestructive,
                  button.style === 'cancel' && styles.buttonCancel,
                ]}
                onPress={() => handlePress(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'destructive' && styles.buttonTextDestructive,
                    button.style === 'cancel' && styles.buttonTextCancel,
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#171F32',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#243150',
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  message: { color: '#94A3B8', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F97316',
  },
  buttonCancel: { backgroundColor: 'transparent' },
  buttonDestructive: { backgroundColor: '#DC2626' },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  buttonTextCancel: { color: '#94A3B8' },
  buttonTextDestructive: { color: '#FFFFFF' },
});
