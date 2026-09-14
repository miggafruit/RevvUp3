import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import * as inquiryApi from '../api/inquiryApi';
import { Inquiry } from '../api/inquiryApi';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MyInquiries'>;

const POLL_INTERVAL_MS = 15000;

const STATUS_LABEL: Record<string, string> = {
  new: 'Waiting for reply',
  responded: 'Replied',
  closed: 'Closed'
};
const STATUS_COLORS: Record<string, string> = {
  new: colors.accent,
  responded: colors.success,
  closed: colors.textMuted
};

// Previously a client's inquiry vanished into the void after the
// "Sent!" confirmation — this endpoint existed on the backend but
// nothing in the app ever called it. This is what actually closes the
// loop: seeing the shop's reply, not just having sent a message.
const MyInquiriesScreen: React.FC<Props> = ({ navigation }) => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await inquiryApi.getInquiriesForClient();
      setInquiries(res.data ?? []);
    } catch (error) {
      console.warn('Failed to load inquiries', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load().finally(() => setIsLoading(false));

      const intervalId = setInterval(load, POLL_INTERVAL_MS);
      return () => clearInterval(intervalId);
    }, [load])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const renderItem = ({ item }: { item: Inquiry }) => {
    const shop = typeof item.shop === 'object' ? item.shop : null;
    const date = new Date(item.createdAt).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.shopText}>{shop?.businessName || 'Shop'}</Text>
          <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[item.status] }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
          </View>
        </View>
        <Text style={styles.dateText}>{date}</Text>

        <Text style={styles.partText}>
          {item.quantity} x {item.partName}
        </Text>
        <Text style={styles.vehicleText}>
          For: {item.vehicleYear} {item.vehicleMake} {item.vehicleModel}
        </Text>

        {item.status === 'responded' && !!item.responseMessage ? (
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>Shop's reply</Text>
            <Text style={styles.replyText}>{item.responseMessage}</Text>
          </View>
        ) : item.status === 'new' ? (
          <Text style={styles.waitingText}>The shop hasn't replied yet — you'll get a notification when they do.</Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Inquiries</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : inquiries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You haven't sent any part inquiries yet.</Text>
        </View>
      ) : (
        <FlatList
          data={inquiries}
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
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shopText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  dateText: { color: colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: spacing.sm },
  statusBadge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  partText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  vehicleText: { color: colors.textSecondary, fontSize: 12.5 },
  waitingText: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: spacing.sm },
  replyBox: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm
  },
  replyLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyText: { color: colors.textPrimary, fontSize: 13, lineHeight: 18 }
});

export default MyInquiriesScreen;
