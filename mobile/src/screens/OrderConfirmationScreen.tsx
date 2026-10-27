import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import * as orderApi from '../api/orderApi';
import { getOrderById } from '../api/orderApi';
import { showAlert } from '../utils/crossPlatformAlert';
import { Order } from '../types/marketplace';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderConfirmation'>;

const POLL_INTERVAL_MS = 4000;

const OrderConfirmationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

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
  const isCash = order.paymentMethod === 'cash';
  const amountDue = order.amountDue ?? order.totalAmount;
  const isAwaitingPayment = order.status === 'confirmed' && order.paymentStatus !== 'paid' && !isCash;
  const isCashBooked = order.status === 'confirmed' && isCash;
  const needsClientConfirm =
    !!order.providerCompletedAt && !order.clientConfirmedAt && order.status !== 'cancelled' && !order.finalizedAt;
  const handleClientConfirm = async () => {
    const send = async () => {
      setConfirming(true);
      try {
        await orderApi.confirmServiceOrder(order._id, isCash ? true : undefined);
        const fresh = await getOrderById(order._id);
        setOrder(fresh);
      } catch (e: any) {
        showAlert('Could Not Confirm', e?.response?.data?.message || 'Please try again');
      } finally {
        setConfirming(false);
      }
    };
    if (isCash) {
      showAlert('Confirm cash payment', `Confirm that you paid R${amountDue.toFixed(2)} in cash and the work is done.`, [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Yes, confirm', onPress: send }
      ]);
    } else {
      send();
    }
  };
  // Only true once payment has actually gone through — this is the sole
  // condition that reveals the Track Delivery button below.
  const isPaidConfirmed = (order.status === 'confirmed' || order.status === 'completed') && order.paymentStatus === 'paid';
  // A service-only order never gets a Delivery record created for it at
  // all (see deliveryController.createDeliveryForOrder — it returns
  // null when there are no product line items), so "Track Delivery"
  // used to be shown for those too, sending the client to a screen with
  // nothing to actually track.
  const hasProductItems = order.items?.some((item) => item.itemType === 'product') ?? false;
  const canTrackDelivery = isPaidConfirmed && hasProductItems;
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
              {hasProductItems
                ? "Payment received. We're finding a delivery driver for your order — tap Track Delivery to follow it live."
                : order.serviceLocationType === 'at_provider'
                ? 'Payment received. Take your vehicle to the provider at the address below at the agreed time.'
                : 'Payment received. The provider will come to your vehicle at the address below.'}
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
          {!!order.serviceLocationType && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {order.serviceLocationType === 'at_provider' ? 'Take vehicle to' : 'Service at'}
              </Text>
              <Text style={[styles.summaryValue, { flexShrink: 1, textAlign: 'right' }]}>{order.deliveryAddress}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>R {order.totalAmount.toLocaleString()}</Text>
          </View>
          {!!order.pointsValue && order.pointsValue > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid with points ⭐</Text>
              <Text style={styles.summaryValue}>- R {order.pointsValue.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{isCash ? 'Cash to pay provider' : 'To pay'}</Text>
            <Text style={styles.summaryValue}>R {amountDue.toFixed(2)}</Text>
          </View>
          {!!order.pointsEarned && order.pointsEarned > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Points earned 🎉</Text>
              <Text style={styles.summaryValue}>+{order.pointsEarned}</Text>
            </View>
          )}
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

        {isCashBooked && !needsClientConfirm && (
          <Text style={[styles.subtitle, { marginBottom: spacing.md }]}>
            Cash booking: pay the provider R {amountDue.toFixed(2)} in cash once the work is done, then confirm here.
          </Text>
        )}

        {needsClientConfirm && (
          <TouchableOpacity
            style={[styles.doneButton, { marginBottom: spacing.md }, confirming && { opacity: 0.6 }]}
            onPress={handleClientConfirm}
            disabled={confirming}
          >
            <Text style={styles.doneButtonText}>
              {isCash ? `Confirm done & cash paid · R ${amountDue.toFixed(2)}` : 'Confirm service done'}
            </Text>
          </TouchableOpacity>
        )}

        {isAwaitingPayment && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.navigate('Payment', { orderId: order._id })}
          >
            <Text style={styles.doneButtonText}>Pay Now · R {amountDue.toFixed(2)}</Text>
          </TouchableOpacity>
        )}

        {/* Only rendered once paid AND the order actually has a physical product to deliver */}
        {canTrackDelivery && (
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