import React, { useCallback, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyProducts, deleteProduct } from '../api/productApi';
import { Product } from '../types/marketplace';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MyProducts'>;

const MyProductsScreen: React.FC<Props> = ({ navigation }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    try {
      const data = await getMyProducts();
      setProducts(data);
    } catch (error) {
      console.warn('Failed to load your products', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadProducts().finally(() => setIsLoading(false));
    }, [loadProducts])
  );

  const handleDelete = (product: Product) => {
    showAlert('Delete Product', `Delete "${product.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(product._id);
            setProducts((prev) => prev.filter((p) => p._id !== product._id));
          } catch (error: any) {
            showAlert('Delete Failed', error?.response?.data?.message || 'Please try again');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={{ color: colors.textMuted, fontSize: 10 }}>No image</Text>
        </View>
      )}

      <View style={styles.cardInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.productPrice}>R {item.price.toLocaleString()}</Text>
        <Text style={styles.productMeta}>
          {item.stock} in stock · {item.category}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('ProductForm', { productId: item._id })}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Products</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ProductForm', undefined)}>
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You haven't posted any products yet.</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('ProductForm', undefined)}
          >
            <Text style={styles.emptyButtonText}>Add Your First Product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
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
  addText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyText: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.xl, textAlign: 'center' },
  emptyButton: { backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radius.pill },
  emptyButtonText: { color: colors.white, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md
  },
  thumbnail: { width: 64, height: 64, borderRadius: radius.sm },
  thumbnailPlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, justifyContent: 'center' },
  productName: { ...typography.cardTitle, color: colors.textPrimary, marginBottom: 2 },
  productPrice: { color: colors.accent, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  productMeta: { color: colors.textMuted, fontSize: 11.5 },
  cardActions: { justifyContent: 'space-between', alignItems: 'flex-end' },
  editButton: { backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  editButtonText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '600' }
});

export default MyProductsScreen;
