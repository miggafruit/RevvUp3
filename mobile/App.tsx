import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { EHailingSocketProvider } from './src/context/EHailingSocketContext';
import { useNotificationResponseListener } from './src/utils/pushNotifications';
import { AlertHost } from './src/utils/crossPlatformAlert';
import RootNavigator from './src/navigation/RootNavigator';
import { initSentry, Sentry } from './src/config/sentry';
import ConnectionStatusBanner from './src/components/ConnectionStatusBanner';

initSentry();

// Previously there was no error boundary anywhere in the app — an
// uncaught render error in any single screen would crash the entire
// app to a blank/red screen with no way back except force-quitting.
// This catches it, reports it to Sentry, and gives the person a way
// to recover without losing their whole session.
const ErrorFallback = ({ resetError }: { resetError: () => void }) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorBody}>
      We've been notified and are looking into it. You can try again below.
    </Text>
    <TouchableOpacity style={styles.errorButton} onPress={resetError}>
      <Text style={styles.errorButtonText}>Try Again</Text>
    </TouchableOpacity>
  </View>
);

function App() {
  useNotificationResponseListener();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Sentry.ErrorBoundary fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}>
        <AuthProvider>
          <EHailingSocketProvider>
            <CartProvider>
              <StatusBar style="light" />
              <RootNavigator />
              <ConnectionStatusBanner />
              <AlertHost />
            </CartProvider>
          </EHailingSocketProvider>
        </AuthProvider>
      </Sentry.ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, backgroundColor: '#0A1628', alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { color: '#E5E7EB', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorBody: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  errorButton: { backgroundColor: '#F97316', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  errorButtonText: { color: 'white', fontWeight: '700', fontSize: 15 }
});

// Sentry.wrap adds touch/gesture breadcrumbs and automatic root-level
// error capture in addition to the explicit boundary above.
export default Sentry.wrap(App);
