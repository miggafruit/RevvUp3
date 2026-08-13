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
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { getMyOrders } from '../api/orderApi';
import { Order } from '../types/marketplace';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Orders'>;

const STATUS_COLORS: Record<string, string> = {
  pending: colors.accent,
  confirmed: colors.success,
  completed: colors.success,
  cancelled: colors.danger
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting for confirmation',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Declined'
};

const OrdersScreen: React.FC<Props> = ({ navigation }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const data = await getMyOrders();
      setOrders(data);
    } catch (error) {
      console.warn('Failed to load orders', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadOrders().finally(() => setIsLoading(false));
    }, [loadOrders])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadOrders();
    setIsRefreshing(false);
  };

  const renderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('OrderConfirmation', { orderId: item._id })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.orderIdText}>#{item._id.slice(-8).toUpperCase()}</Text>
        <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[item.status] }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>
      </View>

      {item.items.map((line, idx) => (
        <Text key={idx} style={styles.lineItem} numberOfLines={1}>
          {line.quantity} x {line.nameSnapshot}
        </Text>
      ))}

      <View style={styles.cardBottom}>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString('en-ZA', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </Text>
        <Text style={styles.totalText}>R {item.totalAmount.toLocaleString()}</Text>
      </View>

      {item.status === 'completed' && (
        <TouchableOpacity
          style={styles.rateButton}
          onPress={() => navigation.navigate('RateOrder', { orderId: item._id })}
        >
          <Text style={styles.rateButtonText}>★ Rate this order</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You haven't placed any orders yet.</Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => navigation.navigate('ShopsList')}>
            <Text style={styles.browseButtonText}>Browse Shops</Text>
          </TouchableOpacity>
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
  emptyText: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.xl, textAlign: 'center' },
  browseButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    borderRadius: radius.pill
  },
  browseButtonText: { color: colors.white, fontWeight: '700' },
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
  statusText: { fontSize: 11, fontWeight: '700' },
  lineItem: { color: colors.textSecondary, fontSize: 12.5, marginBottom: 2 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  dateText: { color: colors.textMuted, fontSize: 11.5 },
  totalText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  rateButton: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center'
  },
  rateButtonText: { color: colors.star, fontWeight: '700', fontSize: 12.5 }
});

export default OrdersScreen;