import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { getProductById } from '../api/productApi';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Product } from '../types/marketplace';
import { useCart } from '../context/CartContext';
import StarRating from '../components/StarRating';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

const ProductDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { productId } = route.params;
  const { addItem, itemCount } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getProductById(productId)
      .then((data) => {
        if (isMounted) setProduct(data);
      })
      .catch((error) => console.warn('Failed to load product', error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [productId]);

  const handleAddToCart = async () => {
    if (!product) return;
    setIsAdding(true);
    try {
      await addItem('product', product._id, quantity);
      showAlert('Added to Cart', `${quantity} x ${product.name} added to your cart.`);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Could not add this item to your cart';
      showAlert('Add to Cart Failed', message);
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.emptyText}>This product could not be found.</Text>
      </SafeAreaView>
    );
  }

  const shopName =
    typeof product.shop === 'object' && product.shop !== null ? product.shop.businessName : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
        <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
          <Text style={{ fontSize: 18 }}>🛒</Text>
          {itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {product.images && product.images.length > 0 ? (
          <Image source={{ uri: product.images[0] }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
            <Text style={{ color: colors.textMuted }}>No image available</Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{product.name}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{product.category}</Text>
            </View>
          </View>

          <Text style={styles.price}>R {product.price.toLocaleString()}</Text>

          <StarRating rating={product.ratingAverage} reviewCount={product.ratingCount} size={13} />

          {shopName && <Text style={styles.soldBy}>Sold by {shopName}</Text>}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>

          {product.specs && product.specs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Specifications</Text>
              <View style={styles.specsTable}>
                {product.specs.map((spec, index) => (
                  <View
                    key={`${spec.key}-${index}`}
                    style={[styles.specRow, index % 2 === 0 && styles.specRowAlt]}
                  >
                    <Text style={styles.specKey}>{spec.key}</Text>
                    <Text style={styles.specValue}>{spec.value}</Text>
                  </View>
                ))}
                <View style={[styles.specRow, product.specs.length % 2 === 0 && styles.specRowAlt]}>
                  <Text style={styles.specKey}>Condition</Text>
                  <Text style={styles.specValue}>{product.condition}</Text>
                </View>
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Delivery</Text>
          <Text style={styles.deliveryText}>🚚 Standard delivery: {product.deliveryEstimate}</Text>
          <Text style={styles.stockText}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{quantity}</Text>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => setQuantity((q) => Math.min(product.stock, q + 1))}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.addToCartButton, (isAdding || product.stock === 0) && styles.addToCartButtonDisabled]}
          onPress={handleAddToCart}
          disabled={isAdding || product.stock === 0}
        >
          <Text style={styles.addToCartButtonText}>
            {product.stock === 0
              ? 'Out of Stock'
              : isAdding
                ? 'Adding…'
                : `🛒 Add to Cart · R ${(product.price * quantity).toLocaleString()}`}
          </Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: { ...typography.cardTitle, fontSize: 16, color: colors.textPrimary },
  cartButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.accent,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  scrollContent: { paddingBottom: 140 },
  heroImage: { width: '100%', height: 220 },
  heroImagePlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { ...typography.title, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  categoryBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4
  },
  categoryBadgeText: { color: colors.accent, fontSize: 11.5, fontWeight: '700' },
  price: { ...typography.price, fontSize: 24, color: colors.accent, marginTop: spacing.sm, marginBottom: spacing.sm },
  soldBy: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  sectionTitle: { ...typography.cardTitle, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.lg },
  description: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20 },
  specsTable: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 11 },
  specRowAlt: { backgroundColor: colors.surface },
  specKey: { color: colors.textMuted, fontSize: 13 },
  specValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  deliveryText: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.xs },
  stockText: { color: colors.textMuted, fontSize: 12.5 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  stepperButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepperButtonText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  stepperValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  addToCartButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center'
  },
  addToCartButtonDisabled: { opacity: 0.6 },
  addToCartButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' }
});

export default ProductDetailScreen;
