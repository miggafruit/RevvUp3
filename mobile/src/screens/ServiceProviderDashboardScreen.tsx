import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Vibration } from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { useEHailingEvents } from '../context/EHailingSocketContext';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceProviderDashboard'>;

const ServiceProviderDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const isFocused = useIsFocused();

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  // This is what actually notifies a driver of a new job — the server
  // only ever delivers "new_request" to dispatch-eligible accounts
  // (see socket.js), so this safely does nothing for a plain service
  // provider with no roadside/delivery capability. Placed here (the
  // driver's landing screen) rather than only inside EHailingDriverScreen
  // because React Navigation keeps this screen mounted as they navigate
  // deeper into the app — previously the listener only existed once
  // EHailingDriverScreen itself was open, so a driver anywhere else in
  // the app (or who hadn't yet tapped "View Job Requests" at all)
  // never got notified in the first place.
  const handleNewRequest = useCallback(
    (request: any) => {
      // If EHailingDriverScreen is on top, it's already handling this
      // request in its own list — showing a popup here too would just
      // be redundant noise on top of what they're already looking at.
      if (!isFocused) return;
      Vibration.vibrate([0, 300, 150, 300]);
      showAlert(
        'New job request',
        `A ${request.serviceType?.replace('_', ' ') ?? 'roadside'} request just came in near you.`,
        [
          { text: 'Dismiss', style: 'cancel' },
          {
            text: 'View',
            onPress: () => navigation.navigate('EHailingDriver', { incomingRequest: request }),
          },
        ]
      );
    },
    [navigation, isFocused]
  );

  // Same pattern as handleNewRequest above, for deliveries — this
  // exact gap (driver only notified while already sitting on the
  // relevant screen) was found and fixed for roadside first; delivery
  // had never gotten the same fix.
  const handleNewDelivery = useCallback(
    (delivery: any) => {
      if (!isFocused) return;
      Vibration.vibrate([0, 300, 150, 300]);
      showAlert(
        'New delivery job',
        'A delivery request just became available.',
        [
          { text: 'Dismiss', style: 'cancel' },
          { text: 'View', onPress: () => navigation.navigate('IncomingDeliveries') },
        ]
      );
    },
    [navigation, isFocused]
  );

  useEHailingEvents({ onNewRequest: handleNewRequest, onNewDelivery: handleNewDelivery });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Service Provider Dashboard</Text>
        <Text style={styles.subtitle}>Welcome, {user?.businessName || user?.name}</Text>

        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('MyServices')}>
          <Text style={styles.bigCardEmoji}>🛠️</Text>
          <Text style={styles.bigCardTitle}>My Services</Text>
          <Text style={styles.bigCardSubtitle}>Add, edit, and manage the services you offer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bigCard}
          onPress={() =>
            navigation.navigate('ServicesBrowse', { providerId: user?.id, providerName: user?.businessName })
          }
        >
          <Text style={styles.bigCardEmoji}>👀</Text>
          <Text style={styles.bigCardTitle}>Preview My Listing</Text>
          <Text style={styles.bigCardSubtitle}>See what clients see when browsing your services</Text>
          
        </TouchableOpacity>
        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('MyPromotions')}>
          <Text style={styles.bigCardEmoji}>🏷️</Text>
          <Text style={styles.bigCardTitle}>Promotions</Text>
          <Text style={styles.bigCardSubtitle}>Run a paid special to get more visibility</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('IncomingOrders')}>
          <Text style={styles.bigCardEmoji}>📥</Text>
          <Text style={styles.bigCardTitle}>Incoming Orders</Text>
          <Text style={styles.bigCardSubtitle}>Accept or decline new bookings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('EHailingDriver')}>
          <Text style={styles.bigCardEmoji}>🚚</Text>
          <Text style={styles.bigCardTitle}>View Job Requests</Text>
          <Text style={styles.bigCardSubtitle}>See and accept incoming roadside assistance jobs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('EHailingHistory')}>
          <Text style={styles.bigCardEmoji}>🕓</Text>
          <Text style={styles.bigCardTitle}>Job History</Text>
          <Text style={styles.bigCardSubtitle}>Review jobs you've completed</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('EditAvailability')}>
          <Text style={styles.bigCardEmoji}>🚚</Text>
          <Text style={styles.bigCardTitle}>Delivery & Roadside Assistance</Text>
          <Text style={styles.bigCardSubtitle}>Opt into delivery or roadside jobs, or update your vehicle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('KycStatus')}>
          <Text style={styles.bigCardEmoji}>🛡️</Text>
          <Text style={styles.bigCardTitle}>Verification Status</Text>
          <Text style={styles.bigCardSubtitle}>Check your KYC status or resubmit documents</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('IncomingDeliveries')}>
          <Text style={styles.bigCardEmoji}>📦</Text>
          <Text style={styles.bigCardTitle}>Incoming Deliveries</Text>
          <Text style={styles.bigCardSubtitle}>Manage your incoming deliveries</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.xl },
  bigCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.md
  },
  bigCardEmoji: { fontSize: 28, marginBottom: spacing.sm },
  bigCardTitle: { ...typography.cardTitle, fontSize: 16, color: colors.textPrimary, marginBottom: 2 },
  bigCardSubtitle: { color: colors.textSecondary, fontSize: 12.5 },
  logoutButton: {
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', marginTop: spacing.xl
  },
  logoutButtonText: { color: colors.danger, fontWeight: '700' }
});

export default ServiceProviderDashboardScreen;
