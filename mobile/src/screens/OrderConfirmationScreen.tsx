import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Animated, Easing } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { getOrderById } from '../api/orderApi';
import { Order } from '../types/marketplace';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderConfirmation'>;

const POLL_INTERVAL_MS = 4000;

const OrderConfirmationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const fetchOrder = async () => {
      try {
        const data = await getOrderById(orderId);
        if (!isMounted) return;
        setOrder(data);
        if (data.status !== 'pending' && intervalId) {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.warn('Failed to load order', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchOrder();
    intervalId = setInterval(fetchOrder, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [orderId]);

  useEffect(() => {
    if (order?.status !== 'pending') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [order?.status, pulse]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.subtitle}>We couldn't find this order.</Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'ClientDashboard' }] })}
          >
            <Text style={styles.doneButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isPending = order.status === 'pending';
  const isAwaitingPayment = order.status === 'confirmed' && order.paymentStatus !== 'paid';
  // Only true once payment has actually gone through — this is the sole
  // condition that reveals the Track Delivery button below.
  const isPaidConfirmed = (order.status === 'confirmed' || order.status === 'completed') && order.paymentStatus === 'paid';
  const isCancelled = order.status === 'cancelled';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {isPending && (
          <>
            <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulse }] }]} />
            <Text style={styles.title}>Waiting for the shop to confirm</Text>
            <Text style={styles.subtitle}>
              Your order has been sent. You haven't been charged yet — this screen will
              update automatically as soon as they accept it, usually within a few minutes.
            </Text>
          </>
        )}

        {isAwaitingPayment && (
          <>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.title}>Order Accepted!</Text>
            <Text style={styles.subtitle}>
              The seller has accepted your order. Complete payment to confirm it.
            </Text>
          </>
        )}

        {isPaidConfirmed && (
          <>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.title}>Order Confirmed!</Text>
            <Text style={styles.subtitle}>
              Payment received. The seller will be in touch to arrange delivery.
            </Text>
          </>
        )}

        {isCancelled && (
          <>
            <Text style={styles.declinedIcon}>✕</Text>
            <Text style={styles.title}>Order Declined</Text>
            <Text style={styles.subtitle}>
              Unfortunately the seller wasn't able to accept this order. You were never
              charged, so there's nothing further needed on your end.
            </Text>
          </>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order ID</Text>
            <Text style={styles.summaryValue}>{order._id.slice(-8).toUpperCase()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>R {order.totalAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Status</Text>
            <Text
              style={[
                styles.summaryValue,
                styles.statusBadge,
                isCancelled && { color: colors.danger },
                isPaidConfirmed && { color: colors.success }
              ]}
            >
              {order.status}
            </Text>
          </View>
        </View>

        {isAwaitingPayment && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.navigate('Payment', { orderId: order._id })}
          >
            <Text style={styles.doneButtonText}>Pay Now · R {order.totalAmount.toLocaleString()}</Text>
          </TouchableOpacity>
        )}

        {/* Only rendered once paymentStatus === 'paid' — see isPaidConfirmed above */}
        {isPaidConfirmed && (
          <TouchableOpacity
            style={[styles.doneButton, { marginBottom: spacing.md }]}
            onPress={() => navigation.navigate('DeliveryTracking', { orderId: order._id })}
          >
            <Text style={styles.doneButtonText}>Track Delivery</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.secondaryButton, (isAwaitingPayment || isPaidConfirmed) && { marginTop: spacing.md }]}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'ClientDashboard' }] })}
        >
          <Text style={isAwaitingPayment || isPaidConfirmed ? styles.secondaryButtonText : styles.doneButtonText}>
            Back to Dashboard
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  pulseDot: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentMuted,
    borderWidth: 3,
    borderColor: colors.accent,
    marginBottom: spacing.lg
  },
  checkmark: {
    fontSize: 40,
    color: colors.white,
    backgroundColor: colors.success,
    width: 72,
    height: 72,
    borderRadius: 36,
    textAlign: 'center',
    lineHeight: 72,
    marginBottom: spacing.lg
  },
  declinedIcon: {
    fontSize: 36,
    color: colors.white,
    backgroundColor: colors.danger,
    width: 72,
    height: 72,
    borderRadius: 36,
    textAlign: 'center',
    lineHeight: 72,
    marginBottom: spacing.lg
  },
  title: { ...typography.title, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: 13.5, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  summaryLabel: { color: colors.textMuted, fontSize: 13 },
  summaryValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  statusBadge: { color: colors.accent, textTransform: 'capitalize' },
  doneButton: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    width: '100%',
    alignItems: 'center'
  },
  doneButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    paddingVertical: 15,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    width: '100%',
    alignItems: 'center'
  },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '700', fontSize: 15 }
});

export default OrderConfirmationScreen;