import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyServices, deleteService } from '../api/serviceApi';
import { Service } from '../types/marketplace';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MyServices'>;

const MyServicesScreen: React.FC<Props> = ({ navigation }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadServices = useCallback(async () => {
    try {
      const data = await getMyServices();
      setServices(data);
    } catch (error) {
      console.warn('Failed to load your services', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadServices().finally(() => setIsLoading(false));
    }, [loadServices])
  );

  const handleDelete = (service: Service) => {
    showAlert('Delete Service', `Delete "${service.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteService(service._id);
            setServices((prev) => prev.filter((s) => s._id !== service._id));
          } catch (error: any) {
            showAlert('Delete Failed', error?.response?.data?.message || 'Please try again');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: Service }) => (
    <View style={styles.card}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={{ color: colors.textMuted, fontSize: 10 }}>No image</Text>
        </View>
      )}

      <View style={styles.cardInfo}>
        <Text style={styles.serviceName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.servicePrice}>R {item.price.toLocaleString()}</Text>
        <Text style={styles.serviceMeta}>
          {item.availability} · {item.category}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('ServiceForm', { serviceId: item._id })}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Services</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ServiceForm', undefined)}>
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : services.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You haven't posted any services yet.</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('ServiceForm', undefined)}
          >
            <Text style={styles.emptyButtonText}>Add Your First Service</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
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
    gap: spacing.md
  },
  thumbnail: { width: 64, height: 64, borderRadius: radius.sm },
  thumbnailPlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, justifyContent: 'center' },
  serviceName: { ...typography.cardTitle, color: colors.textPrimary, marginBottom: 2 },
  servicePrice: { color: colors.accent, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  serviceMeta: { color: colors.textMuted, fontSize: 11.5 },
  cardActions: { justifyContent: 'space-between', alignItems: 'flex-end' },
  editButton: { backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  editButtonText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '600' }
});

export default MyServicesScreen;
