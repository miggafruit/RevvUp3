import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { getRewardsProgram, payForRewardsProgram, RewardsProgram } from '../api/rewardsApi';
import { getPaystackPublicKey } from '../utils/paystackConfig';
import { isTestPaymentEnabled, makeTestReference } from '../api/testPaymentApi';
import PaystackCheckout from '../components/PaystackCheckout';
import RewardsBadge from '../components/RewardsBadge';
import { showAlert } from '../utils/crossPlatformAlert';
import { colors, spacing, radius } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardsProgram'>;

const escapeForJs = (value: string) => value.replace(/'/g, "\\'");

// Where a shop / provider joins (or renews) RevvUp Rewards for R150 a month.
const RewardsProgramScreen: React.FC<Props> = ({ navigation }) => {
  const { user, setUser } = useAuth();
  const [program, setProgram] = useState<RewardsProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [working, setWorking] = useState(false);
  const [testEnabled, setTestEnabled] = useState(false);

  const load = useCallback(async () => {
    try {
      setProgram(await getRewardsProgram());
    } catch (error) {
      console.warn('Failed to load rewards programme', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    isTestPaymentEnabled().then(setTestEnabled);
  }, [load]);

  const finish = async (reference: string) => {
    setPaying(false);
    setWorking(true);
    try {
      const res = await payForRewardsProgram(reference);
      if (user) setUser({ ...user, rewardsActive: true, rewardsActiveUntil: res.activeUntil });
      await load();
      showAlert('You are in! ⭐', 'Your REWARDS badge is live and you now appear first in searches.');
    } catch (error: any) {
      showAlert(
        'Payment Error',
        (error?.response?.data?.message || 'Could not confirm your payment') + `\n\nReference: ${reference}`
      );
    } finally {
      setWorking(false);
    }
  };

  if (paying) {
    let key: string;
    try {
      key = getPaystackPublicKey();
    } catch (e: any) {
      return (
        <SafeAreaView style={styles.safe}>
          <Text style={{ color: 'white', padding: 24 }}>{e.message}</Text>
        </SafeAreaView>
      );
    }
    const html = `
    <html><body>
      <script src="https://js.paystack.co/v1/inline.js"></script>
      <script>
        function pay(){
          var handler = PaystackPop.setup({
            key: '${key}',
            email: '${escapeForJs(user?.email || 'customer@example.com')}',
            amount: ${Math.round((program?.feeRand ?? 150) * 100)},
            currency: 'ZAR',
            metadata: { rewardsSellerId: '${escapeForJs(String(user?.id))}' },
            callback: function(response){ window.ReactNativeWebView.postMessage(response.reference); },
            onClose: function(){ window.ReactNativeWebView.postMessage("cancel"); }
          });
          handler.openIframe();
        }
        pay();
      </script>
    </body></html>`;
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <PaystackCheckout
          html={html}
          onMessage={(data) => {
            if (data === 'cancel') setPaying(false);
            else finish(data);
          }}
        />
      </SafeAreaView>
    );
  }

  const active = !!program?.active;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RevvUp Rewards</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <View style={[styles.status, active ? styles.statusOn : styles.statusOff]}>
            {active ? <RewardsBadge size="large" /> : <Text style={styles.statusOffText}>Not in the rewards programme</Text>}
            {active && program?.activeUntil && (
              <Text style={styles.until}>Active until {new Date(program.activeUntil).toLocaleDateString()}</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>What you get</Text>
          <View style={styles.card}>
            <Text style={styles.line}>⭐ A prominent REWARDS badge on your profile and listings</Text>
            <Text style={styles.line}>⬆️ You are listed above non-participating businesses in searches</Text>
            <Text style={styles.line}>🎁 Your clients earn 2% back in points on every purchase with you</Text>
            {user?.role === 'service_provider' && (
              <Text style={styles.line}>💳 Clients can pay for your services with their points</Text>
            )}
            <Text style={styles.line}>🔁 RevvUp funds the rewards from its commission — you pay only the membership</Text>
          </View>

          <Text style={styles.price}>R{program?.feeRand ?? 150} / {program?.periodDays ?? 30} days</Text>

          <TouchableOpacity style={[styles.button, working && { opacity: 0.6 }]} disabled={working} onPress={() => setPaying(true)}>
            {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{active ? 'Renew for 30 more days' : 'Join RevvUp Rewards'}</Text>}
          </TouchableOpacity>

          {testEnabled && (
            <TouchableOpacity style={styles.testButton} disabled={working} onPress={() => finish(makeTestReference())}>
              <Text style={styles.testText}>TESTER: join without paying</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.fine}>
            Membership is paid month to month — it does not renew by itself. When it lapses your badge and top
            ranking switch off and clients can no longer earn or spend points with you. Renewing early adds on to
            your current expiry.
          </Text>

          {(program?.history ?? []).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Payments</Text>
              {program!.history.map((h) => (
                <View key={h._id} style={styles.row}>
                  <Text style={styles.rowText}>{new Date(h.createdAt).toLocaleDateString()}</Text>
                  <Text style={styles.rowText}>R{h.amount.toFixed(2)}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  back: { color: colors.textPrimary, fontSize: 22 },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  status: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: 8 },
  statusOn: { backgroundColor: colors.surface, borderWidth: 2, borderColor: '#FACC15' },
  statusOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statusOffText: { color: colors.textSecondary, fontWeight: '700' },
  until: { color: colors.textSecondary, fontSize: 13 },
  sectionTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 16, marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 8 },
  line: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  price: { color: colors.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center', marginVertical: spacing.lg },
  button: { backgroundColor: colors.accent, padding: 16, borderRadius: radius.pill, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  testButton: { backgroundColor: '#FACC15', padding: 12, borderRadius: radius.md, alignItems: 'center', marginTop: 12 },
  testText: { color: '#111827', fontWeight: '700' },
  fine: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, lineHeight: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowText: { color: colors.textSecondary }
});

export default RewardsProgramScreen;
