import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopDashboard'>;

const ShopDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Shop Dashboard</Text>
        <Text style={styles.subtitle}>Welcome, {user?.businessName || user?.name}</Text>

        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('MyProducts')}>
          <Text style={styles.bigCardEmoji}>📦</Text>
          <Text style={styles.bigCardTitle}>My Products</Text>
          <Text style={styles.bigCardSubtitle}>Add, edit, and manage the products you sell</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bigCard}
          onPress={() => navigation.navigate('ProductsBrowse', { shopId: user?.id, shopName: user?.businessName })}
        >
          <Text style={styles.bigCardEmoji}>👀</Text>
          <Text style={styles.bigCardTitle}>Preview My Storefront</Text>
          <Text style={styles.bigCardSubtitle}>See what clients see when browsing your shop</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('IncomingOrders')}>
          <Text style={styles.bigCardEmoji}>📥</Text>
          <Text style={styles.bigCardTitle}>Incoming Orders</Text>
          <Text style={styles.bigCardSubtitle}>View and manage orders placed by clients</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('MyPromotions')}>
          <Text style={styles.bigCardEmoji}>🏷️</Text>
          <Text style={styles.bigCardTitle}>My Promotions</Text>
          <Text style={styles.bigCardSubtitle}>Boost your shop's visibility to clients</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bigCard} onPress={() => navigation.navigate('KycStatus')}>
          <Text style={styles.bigCardEmoji}>🛡️</Text>
          <Text style={styles.bigCardTitle}>Verification Status</Text>
          <Text style={styles.bigCardSubtitle}>Check your KYC status or resubmit documents</Text>
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

export default ShopDashboardScreen;
