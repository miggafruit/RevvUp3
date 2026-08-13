import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getServices } from '../api/serviceApi';
import { Service } from '../types/marketplace';
import ServiceCard from '../components/ServiceCard';
import { useCart } from '../context/CartContext';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ServicesBrowse'>;

const CATEGORY_PILLS = ['All', 'Maintenance', 'Bodywork', 'Diagnostics', 'Tyres', 'Detailing'];

const ServicesBrowseScreen: React.FC<Props> = ({ navigation, route }) => {
  const providerId = route.params?.providerId;
  const providerName = route.params?.providerName;
  const { addItem, itemCount } = useCart();

  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const loadServices = useCallback(
    async (searchTerm: string, category: string) => {
      try {
        const { services: results } = await getServices({
          search: searchTerm || undefined,
          category: category === 'All' ? undefined : category,
          provider: providerId
        });
        setServices(results);
      } catch (error) {
        console.warn('Failed to load services', error);
      }
    },
    [providerId]
  );

  useEffect(() => {
    setIsLoading(true);
    loadServices(search, activeCategory).finally(() => setIsLoading(false));
  }, [activeCategory]);

  const handleSearchSubmit = () => {
    setIsLoading(true);
    loadServices(search, activeCategory).finally(() => setIsLoading(false));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadServices(search, activeCategory);
    setIsRefreshing(false);
  };

  const handleAddToCart = async (service: Service) => {
    setAddingId(service._id);
    try {
      await addItem('service', service._id, 1);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Could not add this service to your cart';
      showAlert('Add to Cart Failed', message);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{providerName ? providerName : 'Find best one'}</Text>
          <Text style={styles.headerSubtitle}>auto services</Text>
        </View>
        <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
          <Text style={{ fontSize: 18 }}>🛒</Text>
          {itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_PILLS}
          keyExtractor={(item) => item}
          style={styles.pillList}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => {
            const isActive = activeCategory === item;
            return (
              <TouchableOpacity
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setActiveCategory(item)}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : services.length === 0 ? (
          <Text style={styles.emptyText}>
            No services in this category yet. Try another filter or check back soon.
          </Text>
        ) : (
          <FlatList
            data={services}
            keyExtractor={(item) => item._id}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            contentContainerStyle={{ paddingBottom: spacing.xl, paddingTop: spacing.md }}
            renderItem={({ item }) => (
              <ServiceCard
                service={item}
                onPress={() => navigation.navigate('ServiceDetail', { serviceId: item._id })}
                onAddToCart={() => handleAddToCart(item)}
                isAddingToCart={addingId === item._id}
              />
            )}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          />
        )}
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
  headerTitle: { ...typography.cardTitle, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  headerSubtitle: { fontSize: 11.5, color: colors.textMuted, textAlign: 'center' },
  cartButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.accent,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  container: { flex: 1, paddingHorizontal: spacing.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  searchIcon: { marginRight: spacing.sm, color: colors.textMuted },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  pillList: { marginBottom: spacing.md, flexGrow: 0 },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.white },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg }
});

export default ServicesBrowseScreen;
