import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useRewards } from '../context/RewardsContext';
import { colors, spacing, radius } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Rewards'>;

const LABEL: Record<string, string> = { earn: 'Earned', redeem: 'Spent', redeem_refund: 'Refunded' };

const RewardsScreen: React.FC<Props> = ({ navigation }) => {
  const { summary, refresh } = useRewards();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const points = summary?.points ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Rewards</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>⭐ YOUR POINTS</Text>
          <Text style={styles.heroPoints}>{points.toLocaleString()}</Text>
          <Text style={styles.heroValue}>= R{(summary?.valueRand ?? 0).toFixed(2)} to spend</Text>
        </View>

        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('ProvidersList')}>
          <Text style={styles.ctaText}>Find participating providers →</Text>
          <Text style={styles.ctaSub}>Providers with the ⭐ REWARDS badge are listed first</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.card}>
          <Text style={styles.how}>• Every purchase from a ⭐ REWARDS shop or provider earns you 2% back in points.</Text>
          <Text style={styles.how}>• 10 points = R1.</Text>
          <Text style={styles.how}>• Spend your points on any service from a ⭐ REWARDS provider — choose "Use points" at checkout.</Text>
          <Text style={styles.how}>• Points are added once both you and the seller have confirmed the job is done.</Text>
        </View>

        <Text style={styles.sectionTitle}>Recent activity</Text>
        {(summary?.recent ?? []).length === 0 ? (
          <Text style={styles.empty}>No activity yet — your first purchase at a ⭐ REWARDS seller will show up here.</Text>
        ) : (
          summary!.recent.map((tx) => (
            <View key={tx._id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {LABEL[tx.type]}
                  {tx.sellerName ? ` · ${tx.sellerName}` : ''}
                </Text>
                <Text style={styles.rowSub}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.rowPoints, { color: tx.type === 'redeem' ? colors.danger : colors.success }]}>
                {tx.type === 'redeem' ? '−' : '+'}
                {tx.points}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  back: { color: colors.textPrimary, fontSize: 22 },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  hero: { backgroundColor: '#FACC15', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: spacing.lg },
  heroLabel: { color: '#92400E', fontWeight: '800', letterSpacing: 1 },
  heroPoints: { color: '#111827', fontSize: 64, fontWeight: '900' },
  heroValue: { color: '#374151', fontWeight: '700' },
  cta: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accent },
  ctaText: { color: colors.accent, fontWeight: '800', fontSize: 16 },
  ctaSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 16, marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 6 },
  how: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: 8 },
  rowTitle: { color: colors.textPrimary, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: 12 },
  rowPoints: { fontSize: 18, fontWeight: '800' }
});

export default RewardsScreen;
