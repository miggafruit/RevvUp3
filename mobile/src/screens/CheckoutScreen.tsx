import React, { useState } from 'react';
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
import * as orderApi from '../api/orderApi';
import AddressSearchInput from '../components/AddressSearchInput';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

const CheckoutScreen: React.FC<Props> = ({ navigation }) => {
  const { cart, subtotal, deliveryFee, total, clear } = useCart();
  const { user } = useAuth();

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim()) {
      showAlert('Missing Information', 'Please enter a delivery address');
      return;
    }
    if (!contactPhone.trim()) {
      showAlert('Missing Information', 'Please enter a contact phone number');
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await orderApi.checkout({
        deliveryAddress: deliveryAddress.trim(),
        contactPhone: contactPhone.trim(),
        notes: notes.trim() || undefined
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
            {deliveryFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryRowLabel}>Delivery</Text>
                <Text style={styles.summaryRowValue}>R {deliveryFee.toLocaleString()}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R {total.toLocaleString()}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Delivery Details</Text>

          <Text style={styles.label}>Delivery Address</Text>
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
              <Text style={styles.placeOrderButtonText}>Place Order · R {total.toLocaleString()}</Text>
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