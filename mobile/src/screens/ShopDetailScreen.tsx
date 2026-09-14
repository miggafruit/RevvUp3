import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import * as promotionApi from '../api/promotionApi';
import * as businessApi from '../api/businessApi';
import { ShopListing } from '../types/marketplace';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopDetail'>;

const ShopDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { shopId, shopName } = route.params;
  const [hasPromotion, setHasPromotion] = useState(false);
  const [shop, setShop] = useState<ShopListing | null>(null);

  useEffect(() => {
    promotionApi
      .getActiveSellerIds()
      .then((ids) => setHasPromotion(ids.includes(shopId)))
      .catch((error) => console.warn('Failed to load promotion indicator', error));
    businessApi
      .getShopById(shopId)
      .then(setShop)
      .catch((error) => console.warn('Failed to load shop profile', error));
  }, [shopId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.avatarWrap}>
          {shop?.profilePhoto ? (
            <Image source={{ uri: shop.profilePhoto }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{shopName.charAt(0)}</Text>
            </View>
          )}
          {hasPromotion && <View style={styles.promoDot} />}
        </View>
        <Text style={styles.shopName}>{shopName}</Text>
        {hasPromotion && (
          <View style={styles.promoBadge}>
            <View style={styles.promoBadgeDot} />
            <Text style={styles.promoBadgeText}>Running a special right now</Text>
          </View>
        )}
        <Text style={styles.shopSubtitle}>Browse all products from this shop</Text>

        {!!shop?.qualifications && (
          <View style={styles.qualificationsBox}>
            <Text style={styles.qualificationsTitle}>About this shop</Text>
            <Text style={styles.qualificationsText}>{shop.qualifications}</Text>
          </View>
        )}

        {!!shop?.profileVideoUrl && (
          <TouchableOpacity style={styles.videoLink} onPress={() => Linking.openURL(shop.profileVideoUrl!)}>
            <Text style={styles.videoLinkText}>▶ Watch video</Text>
          </TouchableOpacity>
        )}

        {!!shop?.portfolioImages?.length && (
          <View style={styles.portfolioSection}>
            <Text style={styles.qualificationsTitle}>Photos</Text>
            <View style={styles.portfolioGrid}>
              {shop.portfolioImages.map((img, i) => (
                <Image key={i} source={{ uri: img }} style={styles.portfolioThumb} />
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('ProductsBrowse', { shopId, shopName })}
        >
          <Text style={styles.ctaText}>View Products</Text>
        </TouchableOpacity>
      </ScrollView>
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
  body: { flexGrow: 1, alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  avatarWrap: { position: 'relative', marginBottom: spacing.lg },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.accent },
  avatarPhoto: { width: 88, height: 88, borderRadius: 44 },
  promoDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.background
  },
  shopName: { ...typography.title, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.sm
  },
  promoBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  promoBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  shopSubtitle: { color: colors.textSecondary, fontSize: 13.5, textAlign: 'center', marginBottom: spacing.xxl },
  qualificationsBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  qualificationsTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 13, marginBottom: 6 },
  qualificationsText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  videoLink: { marginBottom: spacing.md },
  videoLinkText: { color: colors.accent, fontWeight: '700', fontSize: 13.5 },
  portfolioSection: { width: '100%', marginBottom: spacing.lg },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  portfolioThumb: { width: 72, height: 72, borderRadius: 10 },
  cta: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill
  },
  ctaText: { color: colors.white, fontWeight: '700', fontSize: 15 }
});

export default ShopDetailScreen;
