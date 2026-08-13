import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import * as promotionApi from '../api/promotionApi';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderDetail'>;

const ProviderDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { providerId, providerName } = route.params;
  const [hasPromotion, setHasPromotion] = useState(false);

  useEffect(() => {
    promotionApi
      .getActiveSellerIds()
      .then((ids) => setHasPromotion(ids.includes(providerId)))
      .catch((error) => console.warn('Failed to load promotion indicator', error));
  }, [providerId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Provider</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{providerName.charAt(0)}</Text>
          </View>
          {hasPromotion && <View style={styles.promoDot} />}
        </View>
        <Text style={styles.providerName}>{providerName}</Text>
        {hasPromotion && (
          <View style={styles.promoBadge}>
            <View style={styles.promoBadgeDot} />
            <Text style={styles.promoBadgeText}>Running a special right now</Text>
          </View>
        )}
        <Text style={styles.providerSubtitle}>Browse all services from this provider</Text>

        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('ServicesBrowse', { providerId, providerName })}
        >
          <Text style={styles.ctaText}>View Services</Text>
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
  headerTitle: { ...typography.cardTitle, fontSize: 17, color: colors.textPrimary },
  body: { flex: 1, alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.xl },
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
  providerName: { ...typography.title, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
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
  providerSubtitle: { color: colors.textSecondary, fontSize: 13.5, textAlign: 'center', marginBottom: spacing.xxl },
  cta: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill
  },
  ctaText: { color: colors.white, fontWeight: '700', fontSize: 15 }
});

export default ProviderDetailScreen;