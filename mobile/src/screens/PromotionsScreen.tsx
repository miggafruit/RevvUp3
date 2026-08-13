import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../types/navigation';
import * as promotionApi from '../api/promotionApi';
import { Promotion } from '../types/marketplace';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Promotions'>;

const daysRemaining = (endDate?: string): string => {
  if (!endDate) return '';
  const diffMs = new Date(endDate).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
};

const PromotionsScreen: React.FC<Props> = ({ navigation }) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPromotions = useCallback(async (searchTerm: string) => {
    try {
      const data = await promotionApi.getPromotions({ search: searchTerm || undefined });
      setPromotions(data);
    } catch (error) {
      console.warn('Failed to load promotions', error);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadPromotions('').finally(() => setIsLoading(false));
  }, []);

  const handleSearchSubmit = () => {
    setIsLoading(true);
    loadPromotions(search).finally(() => setIsLoading(false));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPromotions(search);
    setIsRefreshing(false);
  };

  const handlePress = (promo: Promotion) => {
    const seller = typeof promo.seller === 'object' ? promo.seller : null;
    if (!seller) return;

    if (promo.sellerRole === 'shop') {
      navigation.navigate('ShopDetail', { shopId: seller._id, shopName: seller.businessName || 'Shop' });
    } else {
      navigation.navigate('ProviderDetail', {
        providerId: seller._id,
        providerName: seller.businessName || 'Provider'
      });
    }
  };

  const renderItem = ({ item }: { item: Promotion }) => {
    const seller = typeof item.seller === 'object' ? item.seller : null;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => handlePress(item)}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={{ fontSize: 24 }}>🏷️</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.metaRow}>
            {seller?.businessName && <Text style={styles.sellerName}>{seller.businessName}</Text>}
            <Text style={styles.daysLeft}>{daysRemaining(item.endDate)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Specials</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search promotions..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : promotions.length === 0 ? (
          <Text style={styles.emptyText}>No active specials right now. Check back soon.</Text>
        ) : (
          <FlatList
            data={promotions}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
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
  container: { flex: 1, paddingHorizontal: spacing.lg },
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
  searchIcon: { marginRight: spacing.sm, color: colors.textMuted },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden'
  },
  image: { width: 90, height: 90 },
  imagePlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  title: { ...typography.cardTitle, color: colors.textPrimary, marginBottom: 2 },
  description: { color: colors.textSecondary, fontSize: 12.5, marginBottom: spacing.xs },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sellerName: { color: colors.textMuted, fontSize: 11.5 },
  daysLeft: { color: colors.accent, fontSize: 11.5, fontWeight: '700' }
});

export default PromotionsScreen;