import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { EHailingSocketProvider } from './src/context/EHailingSocketContext';
import { useNotificationResponseListener } from './src/utils/pushNotifications';
import { AlertHost } from './src/utils/crossPlatformAlert';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  useNotificationResponseListener();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <EHailingSocketProvider>
          <CartProvider>
            <StatusBar style="light" />
            <RootNavigator />
            <AlertHost />
          </CartProvider>
        </EHailingSocketProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
