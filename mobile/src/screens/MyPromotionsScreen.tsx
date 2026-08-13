import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import * as promotionApi from '../api/promotionApi';
import { PROMOTION_TIERS } from '../api/promotionTiers';
import { Promotion } from '../types/marketplace';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MyPromotions'>;

const getStatus = (promo: Promotion): { label: string; color: string } => {
  if (promo.paymentStatus === 'pending') return { label: 'Payment Pending', color: colors.accent };
  if (promo.endDate && new Date(promo.endDate) > new Date()) return { label: 'Active', color: colors.success };
  return { label: 'Expired', color: colors.textMuted };
};

const MyPromotionsScreen: React.FC<Props> = ({ navigation }) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPromotions = useCallback(async () => {
    try {
      const data = await promotionApi.getMyPromotions();
      setPromotions(data);
    } catch (error) {
      console.warn('Failed to load your promotions', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadPromotions().finally(() => setIsLoading(false));
    }, [loadPromotions])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPromotions();
    setIsRefreshing(false);
  };

  const renderItem = ({ item }: { item: Promotion }) => {
    const status = getStatus(item);
    return (
      <View style={styles.card}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Text style={{ fontSize: 20 }}>🏷️</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.meta}>
            {PROMOTION_TIERS[item.tier].label} · R {item.price.toLocaleString()}
          </Text>
          <View style={[styles.statusBadge, { borderColor: status.color }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        {item.paymentStatus === 'pending' && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => navigation.navigate('PromotionPayment', { promotionId: item._id })}
          >
            <Text style={styles.payButtonText}>Pay</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Promotions</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreatePromotion')}>
          <Text style={styles.addText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : promotions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You haven't run any promotions yet.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('CreatePromotion')}>
            <Text style={styles.emptyButtonText}>Create Your First Promotion</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={promotions}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
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
    gap: spacing.md,
    alignItems: 'center'
  },
  thumbnail: { width: 56, height: 56, borderRadius: radius.sm },
  thumbnailPlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  title: { ...typography.cardTitle, color: colors.textPrimary, marginBottom: 2 },
  meta: { color: colors.textMuted, fontSize: 11.5, marginBottom: spacing.xs },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  },
  statusText: { fontSize: 10.5, fontWeight: '700' },
  payButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill
  },
  payButtonText: { color: colors.white, fontSize: 12, fontWeight: '700' }
});

export default MyPromotionsScreen;