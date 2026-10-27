import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useRewards } from '../context/RewardsContext';
import RewardsBadge from '../components/RewardsBadge';
import * as orderApi from '../api/orderApi';
import AddressSearchInput from '../components/AddressSearchInput';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

const CheckoutScreen: React.FC<Props> = ({ navigation }) => {
  const { cart, subtotal, seller, clear } = useCart();
  const { user } = useAuth();

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quote, setQuote] = useState<orderApi.DeliveryQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const { summary: rewards } = useRewards();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const [usePoints, setUsePoints] = useState(false);
  const hasProducts = cart.items.some((i) => i.itemType === 'product');
  const isServiceOrder = !hasProducts && cart.items.length > 0;
  // Services: does the provider come to the vehicle, or does the client bring it?
  const [serviceLocationType, setServiceLocationType] = useState<'at_client' | 'at_provider'>('at_client');
  const bringingToProvider = isServiceOrder && serviceLocationType === 'at_provider';

  // Delivery depends on the address, so it is priced from the server as soon
  // as a plausible address is entered (debounced while typing).
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!hasProducts || deliveryAddress.trim().length < 8) return;
    let cancelled = false;
    setIsQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await orderApi.getDeliveryQuote(deliveryAddress.trim());
        if (!cancelled) setQuote(q);
      } catch (error: any) {
        if (!cancelled) setQuoteError(error?.response?.data?.message || 'Could not calculate delivery for this address.');
      } finally {
        if (!cancelled) setIsQuoting(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [deliveryAddress, hasProducts]);

  const shownDeliveryFee = hasProducts ? quote?.deliveryFee ?? 0 : 0;
  const shownTotal = subtotal + shownDeliveryFee;
  const sellerRewards = !!seller?.rewardsActive;
  const pointsBalance = rewards?.points ?? 0;
  const canRedeem = isServiceOrder && sellerRewards && pointsBalance > 0;
  // 10 points = R1, capped at the order total
  const pointsToUse = usePoints && canRedeem ? Math.min(pointsBalance, Math.floor(shownTotal * 10)) : 0;
  const pointsValueRand = pointsToUse / 10;
  const amountToPay = Math.max(0, shownTotal - pointsValueRand);
  const earnPoints = sellerRewards ? Math.floor(((subtotal * 0.02) / 0.1)) : 0;

  const handlePlaceOrder = async () => {
    if (!bringingToProvider && !deliveryAddress.trim()) {
      showAlert(
        'Missing Information',
        isServiceOrder ? 'Please tell the provider where the vehicle is' : 'Please enter a delivery address'
      );
      return;
    }
    if (!contactPhone.trim()) {
      showAlert('Missing Information', 'Please enter a contact phone number');
      return;
    }
    if (hasProducts && !quote) {
      showAlert('Delivery not priced yet', quoteError || 'Please wait while we calculate delivery for your address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await orderApi.checkout({
        deliveryAddress: bringingToProvider ? undefined : deliveryAddress.trim(),
        serviceLocationType: isServiceOrder ? serviceLocationType : undefined,
        contactPhone: contactPhone.trim(),
        notes: notes.trim() || undefined,
        paymentMethod: isServiceOrder ? paymentMethod : undefined,
        redeemPoints: pointsToUse > 0 ? pointsToUse : undefined
      });
      await clear();
      navigation.replace('OrderConfirmation', { orderId: order._id });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Something went wrong placing your order';
      showAlert('Checkout Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            {cart.items.map((item) => {
              const source = item.itemType === 'product' ? item.product : item.service;
              if (!source) return null;
              return (
                <View key={item._id} style={styles.summaryRow}>
                  <Text style={styles.summaryItemName} numberOfLines={1}>
                    {item.quantity} x {source.name}
                  </Text>
                  <Text style={styles.summaryItemPrice}>
                    R {(source.price * item.quantity).toLocaleString()}
                  </Text>
                </View>
              );
            })}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryRowLabel}>Subtotal</Text>
              <Text style={styles.summaryRowValue}>R {subtotal.toLocaleString()}</Text>
            </View>
            {hasProducts && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryRowLabel}>
                  Delivery{quote ? ` (${quote.distanceKm} km, ${quote.totalWeightKg} kg)` : ''}
                </Text>
                <Text style={styles.summaryRowValue}>
                  {quote
                    ? `R ${quote.deliveryFee.toLocaleString()}`
                    : isQuoting
                    ? 'Calculating…'
                    : quoteError
                    ? 'Unavailable'
                    : 'Enter address'}
                </Text>
              </View>
            )}
            {quoteError && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{quoteError}</Text>}
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R {shownTotal.toLocaleString()}</Text>
            </View>
          </View>

          {sellerRewards && (
            <View style={{ marginBottom: spacing.md }}>
              <RewardsBadge size="large" />
              {earnPoints > 0 && (
                <Text style={{ color: colors.textSecondary, marginTop: 6, fontSize: 12 }}>
                  You will earn about {earnPoints} points when this order is completed.
                </Text>
              )}
            </View>
          )}

          {isServiceOrder && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['card', 'cash'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setPaymentMethod(m)}
                    style={{
                      flex: 1, padding: 12, borderRadius: radius.md ?? 10, borderWidth: 2, alignItems: 'center',
                      borderColor: paymentMethod === m ? colors.accent : colors.border ?? '#444'
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{m === 'card' ? '💳 Pay online' : '💵 Cash'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {paymentMethod === 'cash' && (
                <Text style={{ color: colors.textSecondary, marginTop: 6, fontSize: 12 }}>
                  Pay the provider in cash after the work is done, then confirm in the app. Both sides must confirm.
                </Text>
              )}
              {canRedeem && (
                <TouchableOpacity
                  onPress={() => setUsePoints((v) => !v)}
                  style={{ marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: usePoints ? '#FACC15' : colors.border ?? '#444' }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                    {usePoints ? '✅' : '⭐'} Use my points ({pointsBalance} pts = R{(pointsBalance / 10).toFixed(2)})
                  </Text>
                  {usePoints && (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Using {pointsToUse} pts · saves R{pointsValueRand.toFixed(2)}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {isServiceOrder && !sellerRewards && pointsBalance > 0 && (
                <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 12 }}>
                  Points can only be used with providers showing the ⭐ REWARDS badge.
                </Text>
              )}
            </View>
          )}

          <Text style={styles.sectionTitle}>{isServiceOrder ? 'Service Location' : 'Delivery Details'}</Text>

          {isServiceOrder && (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {([
                  ['at_client', 'Come to my vehicle'],
                  ['at_provider', "I'll bring it to them"]
                ] as const).map(([value, label]) => {
                  const active = serviceLocationType === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setServiceLocationType(value)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: active ? colors.accent : colors.border,
                        backgroundColor: active ? colors.accent : colors.surface,
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: active ? '#fff' : colors.textPrimary, fontWeight: '700', textAlign: 'center' }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {bringingToProvider && (
                <View style={{ padding: 12, borderRadius: 10, backgroundColor: colors.surface, marginBottom: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    You will take your vehicle to {seller?.businessName || 'the provider'}. They'll be told you're
                    bringing it in.
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 6 }}>
                    📍 {seller?.businessAddress || 'Address will be shown once the provider accepts'}
                  </Text>
                </View>
              )}
            </>
          )}

          {!bringingToProvider && (
          <>
          <Text style={styles.label}>
            {isServiceOrder ? 'Where is the vehicle? (address the work happens at)' : 'Delivery Address'}
          </Text>
          <AddressSearchInput
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
            onSelectPlace={(details) => setDeliveryAddress(details.address)}
            placeholder="Street address, city, postal code"
            colorOverrides={{
              inputBg: colors.surface,
              border: colors.border,
              text: colors.textPrimary,
              placeholder: colors.textMuted,
              icon: colors.accent,
              predictionSecondary: colors.textSecondary,
            }}
          />
          </>
          )}

          <Text style={styles.label}>Contact Phone</Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+27 71 234 5678"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>
            Notes <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything the seller should know"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text style={styles.disclaimer}>
            You won't be charged yet. Your order is sent to the seller first — you'll
            be asked to pay only once they accept it.
          </Text>

          <TouchableOpacity
            style={[styles.placeOrderButton, isSubmitting && styles.placeOrderButtonDisabled]}
            onPress={handlePlaceOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.placeOrderButtonText}>Place Order · R {amountToPay.toLocaleString()}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.cardTitle, fontSize: 15, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  summaryItemName: { color: colors.textSecondary, fontSize: 13, flex: 1, marginRight: spacing.sm },
  summaryItemPrice: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  totalLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  totalValue: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  summaryRowLabel: { color: colors.textSecondary, fontSize: 13 },
  summaryRowValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  optional: { fontWeight: '400', color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary
  },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },
  disclaimer: { color: colors.textMuted, fontSize: 11.5, marginTop: spacing.lg, lineHeight: 17 },
  placeOrderButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl
  },
  placeOrderButtonDisabled: { opacity: 0.6 },
  placeOrderButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 }
});

export default CheckoutScreen;