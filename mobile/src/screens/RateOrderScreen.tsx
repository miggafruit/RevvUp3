import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { getOrderById } from '../api/orderApi';
import { createRating, getMyRatingsForOrder, MyRating } from '../api/ratingApi';
import { Order } from '../types/marketplace';
import StarPicker from '../components/StarPicker';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RateOrder'>;

type OrderLine = Order['items'][number];

const itemKey = (line: OrderLine) => `${line.itemType}:${line.itemType === 'product' ? line.product : line.service}`;

const RateOrderScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [alreadyRated, setAlreadyRated] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { stars: number; comment: string }>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [orderData, ratings] = await Promise.all([getOrderById(orderId), getMyRatingsForOrder(orderId)]);
      setOrder(orderData);
      setAlreadyRated(
        new Set(
          ratings.map((r: MyRating) => `${r.itemType}:${r.itemType === 'product' ? r.product : r.service}`)
        )
      );
    } catch {
      showAlert('Error', "Couldn't load this order.", [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSubmit = async (line: OrderLine) => {
    const key = itemKey(line);
    const draft = drafts[key];
    if (!draft?.stars) {
      showAlert('Pick a rating', 'Tap a star to rate this item first.');
      return;
    }

    setSubmittingKey(key);
    try {
      await createRating({
        orderId,
        itemType: line.itemType,
        itemId: line.itemType === 'product' ? line.product! : line.service!,
        rating: draft.stars,
        comment: draft.comment.trim() || undefined
      });
      setAlreadyRated((prev) => new Set(prev).add(key));
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.message || 'Could not submit this rating.');
    } finally {
      setSubmittingKey(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  if (!order) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {order.items.map((line, idx) => {
          const key = itemKey(line);
          const isDone = alreadyRated.has(key);
          const draft = drafts[key] || { stars: 0, comment: '' };

          return (
            <View key={idx} style={styles.card}>
              <Text style={styles.itemName}>{line.nameSnapshot}</Text>

              {isDone ? (
                <Text style={styles.doneText}>✓ You rated this item</Text>
              ) : (
                <>
                  <StarPicker
                    value={draft.stars}
                    onChange={(stars) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, stars } }))}
                  />
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment (optional)"
                    placeholderTextColor={colors.textMuted}
                    value={draft.comment}
                    onChangeText={(comment) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, comment } }))}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, submittingKey === key && { opacity: 0.6 }]}
                    onPress={() => handleSubmit(line)}
                    disabled={submittingKey === key}
                  >
                    <Text style={styles.submitButtonText}>
                      {submittingKey === key ? 'Submitting…' : 'Submit Rating'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  itemName: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, marginBottom: spacing.sm },
  doneText: { color: colors.success, fontSize: 13, fontWeight: '600' },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    fontSize: 13,
    padding: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top'
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: spacing.sm
  },
  submitButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 }
});

export default RateOrderScreen;
