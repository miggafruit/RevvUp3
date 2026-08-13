import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import * as orderApi from '../api/orderApi';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'IncomingOrders'>;

const POLL_INTERVAL_MS = 15000;

const STATUS_COLORS: Record<string, string> = {
  pending: colors.accent,
  confirmed: colors.success,
  completed: colors.success,
  cancelled: colors.danger
};

const IncomingOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await orderApi.getIncomingOrders();
      setOrders(data);
    } catch (error) {
      console.warn('Failed to load incoming orders', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadOrders().finally(() => setIsLoading(false));

      const intervalId = setInterval(loadOrders, POLL_INTERVAL_MS);
      return () => clearInterval(intervalId);
    }, [loadOrders])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadOrders();
    setIsRefreshing(false);
  };

  const handleAccept = async (orderId: string) => {
    setActioningId(orderId);
    try {
      await orderApi.updateOrderStatus(orderId, 'confirmed');
      await loadOrders();
    } catch (error: any) {
      showAlert('Could Not Accept', error?.response?.data?.message || 'Please try again');
    } finally {
      setActioningId(null);
    }
  };

  const handleDecline = (orderId: string) => {
    showAlert('Decline Order', 'Are you sure you want to decline this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActioningId(orderId);
          try {
            await orderApi.updateOrderStatus(orderId, 'cancelled');
            await loadOrders();
          } catch (error: any) {
            showAlert('Could Not Decline', error?.response?.data?.message || 'Please try again');
          } finally {
            setActioningId(null);
          }
        }
      }
    ]);
  };

  const handleComplete = async (orderId: string) => {
    setActioningId(orderId);
    try {
      await orderApi.completeServiceOrder(orderId);
      await loadOrders();
    } catch (error: any) {
      showAlert('Could Not Complete', error?.response?.data?.message || 'Please try again');
    } finally {
      setActioningId(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const clientName = typeof item.client === 'object' ? item.client?.name : 'Client';
    const isPending = item.status === 'pending';
    const isActioning = actioningId === item._id;
    const hasProductItems = item.items.some((line: any) => line.itemType === 'product');
    const canMarkComplete = item.status === 'confirmed' && item.paymentStatus === 'paid' && !hasProductItems;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.orderIdText}>#{item._id.slice(-8).toUpperCase()}</Text>
          <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[item.status] }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.clientText}>From {clientName}</Text>

        {item.items.map((line: any, idx: number) => (
          <Text key={idx} style={styles.lineItem} numberOfLines={1}>
            {line.quantity} x {line.nameSnapshot} · R {line.lineTotal.toLocaleString()}
          </Text>
        ))}

        <Text style={styles.deliveryText} numberOfLines={2}>
          📍 {item.deliveryAddress}
        </Text>
        <Text style={styles.phoneText}>📞 {item.contactPhone}</Text>

        {isPending && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => handleDecline(item._id)}
              disabled={isActioning}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptButton, isActioning && { opacity: 0.6 }]}
              onPress={() => handleAccept(item._id)}
              disabled={isActioning}
            >
              {isActioning ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {canMarkComplete && (
          <TouchableOpacity
            style={[styles.acceptButton, { marginTop: spacing.sm }, isActioning && { opacity: 0.6 }]}
            onPress={() => handleComplete(item._id)}
            disabled={isActioning}
          >
            {isActioning ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.acceptButtonText}>Mark Service Complete</Text>
            )}
          </TouchableOpacity>
        )}

        {item.status === 'confirmed' && !hasProductItems && item.paymentStatus !== 'paid' && (
          <Text style={styles.waitingPaymentText}>Waiting for the client to pay before this can be marked done.</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incoming Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No orders yet. New orders will appear here automatically.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  backArrow: { color: colors.textPrimary, fontSize: 20 },
  headerTitle: { ...typography.cardTitle, fontSize: 17, color: colors.textPrimary },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  orderIdText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  statusBadge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  clientText: { color: colors.textSecondary, fontSize: 12.5, marginBottom: spacing.sm },
  lineItem: { color: colors.textPrimary, fontSize: 12.5, marginBottom: 2 },
  deliveryText: { color: colors.textMuted, fontSize: 11.5, marginTop: spacing.sm },
  phoneText: { color: colors.textMuted, fontSize: 11.5, marginBottom: spacing.sm },
  waitingPaymentText: { color: colors.textMuted, fontSize: 11.5, fontStyle: 'italic', marginTop: spacing.xs },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  declineButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center'
  },
  declineButtonText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center'
  },
  acceptButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 }
});

export default IncomingOrdersScreen;