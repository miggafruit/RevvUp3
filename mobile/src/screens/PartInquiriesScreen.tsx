import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import * as inquiryApi from '../api/inquiryApi';
import { Inquiry, InquiryReplyType } from '../api/inquiryApi';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PartInquiries'>;

const POLL_INTERVAL_MS = 15000;

const STATUS_COLORS: Record<string, string> = {
  new: colors.accent,
  responded: colors.success,
  closed: colors.textMuted
};

// The three one-tap replies covering the common cases — a shop can
// still write their own with the "Something else" option below.
const QUICK_REPLIES: { type: InquiryReplyType; label: string }[] = [
  { type: 'available', label: 'Yes, available' },
  { type: 'check_back', label: 'Need to check' },
  { type: 'not_available', label: 'Not available' }
];

const PartInquiriesScreen: React.FC<Props> = ({ navigation }) => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [customReplyForId, setCustomReplyForId] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await inquiryApi.getInquiriesForShop();
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

  const handleQuickReply = async (id: string, replyType: InquiryReplyType) => {
    setActioningId(id);
    try {
      await inquiryApi.respondToInquiry(id, replyType);
      await load();
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.message || 'Please try again');
    } finally {
      setActioningId(null);
    }
  };

  const handleSendCustomReply = async (id: string) => {
    if (!customText.trim()) return;
    setActioningId(id);
    try {
      await inquiryApi.respondToInquiry(id, 'custom', customText.trim());
      setCustomReplyForId(null);
      setCustomText('');
      await load();
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.message || 'Please try again');
    } finally {
      setActioningId(null);
    }
  };

  const handleClose = (id: string) => {
    showAlert('Close Inquiry', 'Close this without sending a reply?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        onPress: async () => {
          setActioningId(id);
          try {
            await inquiryApi.closeInquiry(id);
            await load();
          } catch (error: any) {
            showAlert('Error', error?.response?.data?.message || 'Please try again');
          } finally {
            setActioningId(null);
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: Inquiry }) => {
    const client = typeof item.client === 'object' ? item.client : null;
    const isActioning = actioningId === item._id;
    const isWritingCustom = customReplyForId === item._id;
    const date = new Date(item.createdAt).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.clientText}>{client?.name || 'Client'}</Text>
          <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[item.status] }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.dateText}>{date}</Text>

        <Text style={styles.partText}>
          {item.quantity} x {item.partName}
        </Text>
        <Text style={styles.vehicleText}>
          For: {item.vehicleYear} {item.vehicleMake} {item.vehicleModel}
        </Text>
        {!!item.additionalDetails && (
          <Text style={styles.detailsText} numberOfLines={3}>
            "{item.additionalDetails}"
          </Text>
        )}
        {!!client?.phone && (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${client.phone}`)}>
            <Text style={styles.phoneText}>📞 {client.phone}</Text>
          </TouchableOpacity>
        )}

        {/* Once responded, show exactly what was sent — this used to
            be invisible even to the shop that sent it, since only a
            bare status flag was ever stored. */}
        {item.status === 'responded' && !!item.responseMessage && (
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>Your reply:</Text>
            <Text style={styles.replyText}>{item.responseMessage}</Text>
          </View>
        )}

        {item.status === 'new' && !isWritingCustom && (
          <>
            <View style={styles.quickReplyGrid}>
              {QUICK_REPLIES.map((reply) => (
                <TouchableOpacity
                  key={reply.type}
                  style={[styles.quickReplyChip, isActioning && { opacity: 0.6 }]}
                  onPress={() => handleQuickReply(item._id, reply.type)}
                  disabled={isActioning}
                >
                  {isActioning ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.quickReplyChipText}>{reply.label}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.customReplyLink}
                onPress={() => setCustomReplyForId(item._id)}
                disabled={isActioning}
              >
                <Text style={styles.customReplyLinkText}>Write something else</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={() => handleClose(item._id)} disabled={isActioning}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {isWritingCustom && (
          <View style={styles.customReplyBox}>
            <TextInput
              style={styles.customReplyInput}
              value={customText}
              onChangeText={setCustomText}
              placeholder="Type your reply to the client..."
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.respondButton, (isActioning || !customText.trim()) && { opacity: 0.6 }]}
                onPress={() => handleSendCustomReply(item._id)}
                disabled={isActioning || !customText.trim()}
              >
                {isActioning ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.respondButtonText}>Send Reply</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setCustomReplyForId(null);
                  setCustomText('');
                }}
                disabled={isActioning}
              >
                <Text style={styles.closeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
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
        <Text style={styles.headerTitle}>Part Inquiries</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : inquiries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No inquiries yet. New part requests from clients will appear here.</Text>
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
  clientText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  dateText: { color: colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: spacing.sm },
  statusBadge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  partText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  vehicleText: { color: colors.textSecondary, fontSize: 12.5, marginBottom: spacing.xs },
  detailsText: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: spacing.xs },
  phoneText: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  quickReplyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  quickReplyChip: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.md
  },
  quickReplyChipText: { color: colors.white, fontWeight: '700', fontSize: 12.5 },
  customReplyLink: { justifyContent: 'center' },
  customReplyLinkText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '600', textDecorationLine: 'underline' },
  customReplyBox: { marginTop: spacing.sm },
  customReplyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: spacing.sm
  },
  replyBox: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm
  },
  replyLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyText: { color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
  respondButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center'
  },
  respondButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  closeButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center'
  },
  closeButtonText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 }
});

export default PartInquiriesScreen;
