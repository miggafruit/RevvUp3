import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
  Modal,
  Animated
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProducts } from '../api/productApi';
import { Product } from '../types/marketplace';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductsBrowse'>;

const CATEGORY_PILLS = ['All', 'Body', 'Oil', 'Tires', 'Exhaust', 'Brakes', 'Electrical'];

const ProductsBrowseScreen: React.FC<Props> = ({ navigation, route }) => {
  const shopId = route.params?.shopId;
  const shopName = route.params?.shopName;
  const { addItem, itemCount } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  // ⭐ INQUIRY FORM STATE
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    partName: '',
    quantity: '',
    additionalDetails: ''
  });

  // ⭐ TOAST STATE
  const [toastProduct, setToastProduct] = useState('');
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (productName: string) => {
    setToastProduct(productName);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    Animated.sequence([
      Animated.spring(toastAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const loadProducts = useCallback(
    async (searchTerm: string, category: string) => {
      try {
        const { products: results } = await getProducts({
          search: searchTerm || undefined,
          category: category === 'All' ? undefined : category,
          shop: shopId
        });
        setProducts(results);
      } catch (error) {
        console.warn('Failed to load products', error);
      }
    },
    [shopId]
  );

  useEffect(() => {
    setIsLoading(true);
    loadProducts(search, activeCategory).finally(() => setIsLoading(false));
  }, [activeCategory]);

  const handleSearchSubmit = () => {
    setIsLoading(true);
    loadProducts(search, activeCategory).finally(() => setIsLoading(false));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProducts(search, activeCategory);
    setIsRefreshing(false);
  };

  const handleAddToCart = async (product: Product) => {
    setAddingId(product._id);
    try {
      await addItem('product', product._id, 1);
      showToast(product.name); // ⭐ replaced alert-on-success with toast
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Could not add this item to your cart';
      showAlert('Add to Cart Failed', message);
    } finally {
      setAddingId(null);
    }
  };

  // ⭐ INQUIRY FORM HANDLERS
  const handleSubmitInquiry = () => {
    const { vehicleMake, vehicleModel, vehicleYear, partName, quantity } = formData;
    if (!vehicleMake || !vehicleModel || !vehicleYear || !partName || !quantity) {
      showAlert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    setSubmitted(true);
  };

  const resetForm = () => {
    setFormData({
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: '',
      partName: '',
      quantity: '',
      additionalDetails: ''
    });
    setSubmitted(false);
    setFormOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ⭐ TOAST */}
      <Animated.View
        style={[styles.toast, { transform: [{ translateY: toastAnim }] }]}
        pointerEvents="none"
      >
        <View style={styles.toastIcon}>
          <Text style={{ color: colors.white, fontSize: 13, fontWeight: '700' }}>✓</Text>
        </View>
        <Text style={styles.toastText}>
          <Text style={styles.toastBold}>{toastProduct}</Text> added to cart
        </Text>
      </Animated.View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{shopName ? shopName : 'Find best one'}</Text>
          <Text style={styles.headerSubtitle}>auto parts</Text>
        </View>
        <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
          <Text style={{ fontSize: 18 }}>🛒</Text>
          {itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* SEARCH + CHAT/INQUIRY BUTTON */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search parts..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
          </View>

          {/* ⭐ INQUIRY BUTTON */}
          <TouchableOpacity style={styles.chatBtn} onPress={() => setFormOpen(true)}>
            <Text style={{ fontSize: 16 }}>💬</Text>
          </TouchableOpacity>
        </View>

        {/* ⭐ BANNER */}
        <View style={styles.banner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Autoparts in{'\n'}unique style</Text>
            <TouchableOpacity style={styles.orderBtn}>
              <Text style={styles.orderBtnText}>Order now</Text>
            </TouchableOpacity>
          </View>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1581093588401-22e81e0d6b16?q=80&w=400'
            }}
            style={styles.bannerImage}
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_PILLS}
          keyExtractor={(item) => item}
          style={styles.pillList}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => {
            const isActive = activeCategory === item;
            return (
              <TouchableOpacity
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setActiveCategory(item)}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : products.length === 0 ? (
          <Text style={styles.emptyText}>
            No products in this category yet. Try another filter or check back soon.
          </Text>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => item._id}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            contentContainerStyle={{ paddingBottom: spacing.xl, paddingTop: spacing.md }}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                onPress={() => navigation.navigate('ProductDetail', { productId: item._id })}
                onAddToCart={() => handleAddToCart(item)}
                isAddingToCart={addingId === item._id}
              />
            )}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          />
        )}
      </View>

      {/* ⭐ INQUIRY FORM MODAL */}
      <Modal visible={formOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Part Inquiry</Text>
              <TouchableOpacity
                onPress={() => {
                  setFormOpen(false);
                  setSubmitted(false);
                }}
              >
                <Text style={{ color: colors.white, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={styles.successContainer}>
                <Text style={{ fontSize: 48 }}>✅</Text>
                <Text style={styles.successTitle}>Request Sent!</Text>
                <Text style={styles.successText}>
                  We've received your inquiry and will get back to you shortly.
                </Text>
                <TouchableOpacity style={styles.doneBtn} onPress={resetForm}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                <Text style={styles.sectionLabel}>Vehicle Information</Text>

                <Text style={styles.fieldLabel}>Vehicle Make *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Toyota"
                  placeholderTextColor={colors.textMuted}
                  value={formData.vehicleMake}
                  onChangeText={(val) => setFormData({ ...formData, vehicleMake: val })}
                />

                <Text style={styles.fieldLabel}>Vehicle Model *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Corolla"
                  placeholderTextColor={colors.textMuted}
                  value={formData.vehicleModel}
                  onChangeText={(val) => setFormData({ ...formData, vehicleModel: val })}
                />

                <Text style={styles.fieldLabel}>Vehicle Year *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2019"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={4}
                  value={formData.vehicleYear}
                  onChangeText={(val) => setFormData({ ...formData, vehicleYear: val })}
                />

                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Part Information</Text>

                <Text style={styles.fieldLabel}>Part Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Brake Pads"
                  placeholderTextColor={colors.textMuted}
                  value={formData.partName}
                  onChangeText={(val) => setFormData({ ...formData, partName: val })}
                />

                <Text style={styles.fieldLabel}>Quantity *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={formData.quantity}
                  onChangeText={(val) => setFormData({ ...formData, quantity: val })}
                />

                <Text style={styles.fieldLabel}>Additional Details (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Any extra info about the part or your vehicle..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  value={formData.additionalDetails}
                  onChangeText={(val) => setFormData({ ...formData, additionalDetails: val })}
                />

                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitInquiry}>
                  <Text style={styles.submitBtnText}>Submit Inquiry</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },

  // TOAST
  toast: {
    position: 'absolute',
    top: 16,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 999,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    gap: 10
  },
  toastIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toastText: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  toastBold: { color: colors.textPrimary, fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  backArrow: { color: colors.textPrimary, fontSize: 20 },
  headerTitle: { ...typography.cardTitle, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  headerSubtitle: { fontSize: 11.5, color: colors.textMuted, textAlign: 'center' },
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
  container: { flex: 1, paddingHorizontal: spacing.lg },

  // SEARCH ROW (search + chat button)
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  searchIcon: { marginRight: spacing.sm, color: colors.textMuted },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  chatBtn: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent
  },

  // BANNER
  banner: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: radius.lg ?? radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  bannerTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16, marginBottom: 12, lineHeight: 22 },
  orderBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm ?? radius.md,
    alignSelf: 'flex-start'
  },
  orderBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  bannerImage: { width: 90, height: 90, borderRadius: radius.sm ?? 10 },

  pillList: { marginBottom: spacing.md, flexGrow: 0 },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.white },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  modalBox: {
    height: '80%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12
  },
  fieldLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14,
    marginBottom: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: colors.accent,
    padding: 15,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 8
  },
  submitBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: colors.textPrimary },
  successText: { textAlign: 'center', color: colors.textMuted, lineHeight: 22, marginBottom: 28 },
  doneBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: radius.md
  },
  doneBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 }
});

export default ProductsBrowseScreen;