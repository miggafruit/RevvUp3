import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootStackParamList } from '../types/navigation';
import { getShops } from '../api/businessApi';
import * as promotionApi from '../api/promotionApi';
import { ShopListing } from '../types/marketplace';
import StarRating from '../components/StarRating';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopsList'>;

const CATEGORIES: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { label: 'Garage', icon: 'garage-variant' },
  { label: 'Tyres', icon: 'circle-outline' },
  { label: 'Parts', icon: 'cog' },
  { label: 'Detailing', icon: 'car-wash' },
  { label: 'Battery', icon: 'car-battery' }
];

const ShopsListScreen: React.FC<Props> = ({ navigation }) => {
  const [shops, setShops] = useState<ShopListing[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [promoSellerIds, setPromoSellerIds] = useState<Set<string>>(new Set());

  const loadShops = useCallback(async (searchTerm: string, category: string | null) => {
    try {
      const { shops: results } = await getShops({
        search: searchTerm || undefined,
        category: category || undefined
      });
      setShops(results);
    } catch (error) {
      console.warn('Failed to load shops', error);
    }
  }, []);

  useEffect(() => {
    promotionApi
      .getActiveSellerIds()
      .then((ids) => setPromoSellerIds(new Set(ids)))
      .catch((error) => console.warn('Failed to load promotion indicators', error));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadShops(search, activeCategory).finally(() => setIsLoading(false));
  }, [activeCategory]);

  const handleSearchSubmit = () => {
    setIsLoading(true);
    loadShops(search, activeCategory).finally(() => setIsLoading(false));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadShops(search, activeCategory);
    setIsRefreshing(false);
  };

  const renderShopCard = ({ item }: { item: ShopListing }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate('ShopDetail', { shopId: item._id, shopName: item.businessName })
      }
    >
      <View style={styles.imageWrapper}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <MaterialCommunityIcons name="store-outline" size={30} color={colors.textMuted} />
          </View>
        )}
        {promoSellerIds.has(item._id) && <View style={styles.promoDot} />}
        <View style={styles.heartIcon}>
          <MaterialCommunityIcons name="heart-outline" size={15} color={colors.white} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.shopName} numberOfLines={1}>
          {item.businessName}
        </Text>
        <Text style={styles.shopCategory} numberOfLines={1}>
          {item.category || `${item.productCount} products`}
        </Text>
        <StarRating rating={item.rating || 0} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shops</Text>
        </View>

        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search shops..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item.label}
          style={styles.categoryList}
          contentContainerStyle={{ gap: spacing.md }}
          renderItem={({ item }) => {
            const isActive = activeCategory === item.label;
            return (
              <TouchableOpacity
                style={styles.categoryItem}
                onPress={() => setActiveCategory(isActive ? null : item.label)}
              >
                <View style={[styles.categoryCircle, isActive && styles.categoryCircleActive]}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={24}
                    color={isActive ? colors.white : colors.accent}
                  />
                </View>
                <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        <Text style={styles.sectionTitle}>Shops near you</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : shops.length === 0 ? (
          <Text style={styles.emptyText}>No shops found yet. Check back soon.</Text>
        ) : (
          <FlatList
            data={shops}
            keyExtractor={(item) => item._id}
            renderItem={renderShopCard}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  backArrow: { color: colors.textPrimary, fontSize: 20 },
  headerTitle: { ...typography.cardTitle, fontSize: 17, color: colors.textPrimary },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  categoryList: { marginBottom: spacing.xl, flexGrow: 0 },
  categoryItem: { alignItems: 'center', width: 64 },
  categoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs
  },
  categoryCircleActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  categoryLabel: { fontSize: 11.5, color: colors.textSecondary, textAlign: 'center' },
  categoryLabelActive: { color: colors.accent, fontWeight: '700' },
  sectionTitle: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.lg },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3
  },
  imageWrapper: { width: '100%', height: 110, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  promoDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white
  },
  heartIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardBody: { padding: spacing.md },
  shopName: { ...typography.cardTitle, color: colors.textPrimary, marginBottom: 2 },
  shopCategory: { ...typography.cardSubtitle, color: colors.textSecondary, marginBottom: spacing.xs }
});

export default ShopsListScreen;
