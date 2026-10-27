import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useEHailingSocketConnection } from '../context/EHailingSocketContext';
import { getEarningsSummary, EarningsSummary } from '../api/earningsApi';
import { colors, spacing, radius } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Earnings'>;

const money = (n: number) => `${n < 0 ? '−' : ''}R${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Uber/Bolt-style earnings view. The numbers come from the payout ledger,
// which is only written once a sale is final (both sides confirmed), and the
// screen refreshes itself the instant the server says a sale completed.
const EarningsScreen: React.FC<Props> = ({ navigation }) => {
  const { socket } = useEHailingSocketConnection();
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const next = await getEarningsSummary();
      setData((prev) => {
        if (prev && next.totals.completedSales > prev.totals.completedSales) {
          setFlash(true);
          setTimeout(() => setFlash(false), 2500);
        }
        return next;
      });
    } catch (error) {
      console.warn('Failed to load earnings', error);
    } finally {
      setLoading(false);
      firstLoad.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 15000); // safety net if a live event is missed
      return () => clearInterval(interval);
    }, [load])
  );

  useEffect(() => {
    if (!socket) return;
    socket.on('earnings_updated', load);
    return () => {
      socket.off('earnings_updated', load);
    };
  }, [socket, load]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading || !data ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.accent}
            />
          }
        >
          {flash && <Text style={styles.flash}>💰 New sale completed — your earnings just updated!</Text>}

          <View style={styles.hero}>
            <Text style={styles.heroLabel}>DUE TO YOU AT NEXT PAYOUT</Text>
            <Text style={[styles.heroAmount, data.dueNow < 0 && { color: colors.danger }]}>{money(data.dueNow)}</Text>
            <Text style={styles.heroSub}>
              {data.dueNow < 0
                ? 'You owe RevvUp commission on cash jobs. It will be taken off your next card earnings.'
                : 'Paid to your bank account when RevvUp settles with Paystack.'}
            </Text>
          </View>

          <View style={styles.grid}>
            <Stat label="Today" value={money(data.periods.today.net)} />
            <Stat label="This week" value={money(data.periods.week.net)} />
            <Stat label="This month" value={money(data.periods.month.net)} />
            <Stat label="Already paid out" value={money(data.paidOut)} />
          </View>

          <Text style={styles.sectionTitle}>All time</Text>
          <View style={styles.card}>
            <Row label="Total sales" value={money(data.totals.grossSales)} />
            <Row label="RevvUp commission (8%)" value={`−${money(data.totals.commission)}`} />
            <Row label="Your earnings" value={money(data.totals.netEarned)} bold />
            <Row label="Completed sales" value={String(data.totals.completedSales)} />
            {data.cashCommissionOwed > 0 && <Row label="Cash commission owed to RevvUp" value={money(data.cashCommissionOwed)} danger />}
          </View>

          {data.inProgress.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Waiting for confirmation</Text>
              {data.inProgress.map((p) => (
                <View key={p.orderId} style={styles.pending}>
                  <Text style={styles.rowTitle}>{money(p.amount)} · {p.paymentMethod === 'cash' ? 'cash' : 'card'}</Text>
                  <Text style={styles.rowSub}>
                    {p.waitingFor === 'provider' ? 'Mark the job done when finished' : 'Waiting for the client to confirm'} — counts once both sides confirm
                  </Text>
                </View>
              ))}
            </>
          )}

          <Text style={styles.sectionTitle}>Recent sales</Text>
          {data.recent.length === 0 ? (
            <Text style={styles.empty}>Nothing yet. Completed sales will appear here instantly.</Text>
          ) : (
            data.recent.map((r) => (
              <View key={r.id} style={styles.sale}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{r.description}</Text>
                  <Text style={styles.rowSub}>
                    {new Date(r.createdAt).toLocaleString()} · {r.paymentMethod === 'cash' ? 'Cash' : r.sourceType === 'ride_fare' || r.sourceType === 'delivery_fee' ? '' : 'Card'}
                    {r.status === 'paid' ? ' · Paid out' : ''}
                  </Text>
                  <Text style={styles.rowSub}>
                    Sale {money(r.gross)} · Commission −{money(r.commission)}
                    {r.cashHeld > 0 ? ` · Cash you hold ${money(r.cashHeld)}` : ''}
                  </Text>
                </View>
                <Text style={[styles.net, r.net < 0 && { color: colors.danger }]}>{money(r.net)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const Row = ({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, bold && { color: colors.textPrimary, fontWeight: '800' }]}>{label}</Text>
    <Text style={[styles.rowValue, bold && { fontWeight: '800' }, danger && { color: colors.danger }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  back: { color: colors.textPrimary, fontSize: 22 },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  flash: { backgroundColor: colors.success, color: '#fff', fontWeight: '700', padding: 10, borderRadius: radius.md, textAlign: 'center', marginBottom: 12, overflow: 'hidden' },
  hero: { backgroundColor: colors.surface, borderRadius: 20, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: colors.accent },
  heroLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroAmount: { color: colors.success, fontSize: 44, fontWeight: '900', marginVertical: 4 },
  heroSub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.lg },
  stat: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  statLabel: { color: colors.textSecondary, fontSize: 12 },
  statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginTop: 2 },
  sectionTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 16, marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.textSecondary },
  rowValue: { color: colors.textPrimary },
  pending: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: colors.accent },
  rowTitle: { color: colors.textPrimary, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  sale: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: 8, gap: 8 },
  net: { color: colors.success, fontSize: 17, fontWeight: '800' },
  empty: { color: colors.textMuted, fontSize: 13 }
});

export default EarningsScreen;
