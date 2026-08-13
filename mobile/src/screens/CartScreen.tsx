import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useCart } from '../context/CartContext';
import { CartItem } from '../types/marketplace';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

const CartScreen: React.FC<Props> = ({ navigation }) => {
  const { cart, subtotal, deliveryFee, total, isLoading, refreshCart, updateItem, removeItem } = useCart();

  useFocusEffect(
    useCallback(() => {
      refreshCart();
    }, [refreshCart])
  );

  const handleIncrease = async (item: CartItem) => {
    try {
      await updateItem(item._id, item.quantity + 1);
    } catch (error: any) {
      showAlert('Could not update item', error?.response?.data?.message || 'Please try again');
    }
  };

  const handleDecrease = async (item: CartItem) => {
    if (item.quantity <= 1) return;
    try {
      await updateItem(item._id, item.quantity - 1);
    } catch (error: any) {
      showAlert('Could not update item', error?.response?.data?.message || 'Please try again');
    }
  };

  const handleRemove = (item: CartItem) => {
    showAlert('Remove Item', 'Remove this item from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeItem(item._id);
          } catch (error: any) {
            showAlert('Could not remove item', error?.response?.data?.message || 'Please try again');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: CartItem }) => {
    const source = item.itemType === 'product' ? item.product : item.service;
    if (!source) return null;

    return (
      <View style={styles.itemRow}>
        {source.thumbnail || (source.images && source.images[0]) ? (
          <Image source={{ uri: source.thumbnail || source.images[0] }} style={styles.itemImage} />
        ) : (
          <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
            <Text style={{ color: colors.textMuted, fontSize: 10 }}>No image</Text>
          </View>
        )}

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {source.name}
          </Text>
          <Text style={styles.itemType}>{item.itemType === 'product' ? 'Product' : 'Service'}</Text>
          <Text style={styles.itemPrice}>R {source.price.toLocaleString()}</Text>
        </View>

        <View style={styles.itemActions}>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepperButton} onPress={() => handleDecrease(item)}>
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{item.quantity}</Text>
            <TouchableOpacity style={styles.stepperButton} onPress={() => handleIncrease(item)}>
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => handleRemove(item)}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : cart.items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => navigation.navigate('ShopsList')}>
            <Text style={styles.browseButtonText}>Browse Shops</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart.items}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
          />
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>R {subtotal.toLocaleString()}</Text>
            </View>
            {deliveryFee > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Delivery</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 14 }}>R {deliveryFee.toLocaleString()}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R {total.toLocaleString()}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutButton} onPress={() => navigation.navigate('Checkout')}>
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
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
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: 15, marginBottom: spacing.xl },
  browseButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    borderRadius: radius.pill
  },
  browseButtonText: { color: colors.white, fontWeight: '700' },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md
  },
  itemImage: { width: 64, height: 64, borderRadius: radius.sm },
  itemImagePlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemName: { ...typography.cardTitle, color: colors.textPrimary, marginBottom: 2 },
  itemType: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  itemPrice: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  itemActions: { justifyContent: 'space-between', alignItems: 'flex-end' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  stepperButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  stepperValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', minWidth: 18, textAlign: 'center' },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  totalLabel: { color: colors.textSecondary, fontSize: 15 },
  totalValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  checkoutButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center'
  },
  checkoutButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 }
});

export default CartScreen;
