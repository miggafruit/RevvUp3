import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getServiceById } from '../api/serviceApi';
import { Service } from '../types/marketplace';
import { useCart } from '../context/CartContext';
import StarRating from '../components/StarRating';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceDetail'>;

const ServiceDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { serviceId } = route.params;
  const { addItem, itemCount } = useCart();

  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getServiceById(serviceId)
      .then((data) => {
        if (isMounted) setService(data);
      })
      .catch((error) => console.warn('Failed to load service', error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [serviceId]);

  const handleAddToCart = async () => {
    if (!service) return;
    setIsAdding(true);
    try {
      await addItem('service', service._id, 1);
      showAlert('Added to Cart', `${service.name} added to your cart.`);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Could not add this service to your cart';
      showAlert('Add to Cart Failed', message);
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.emptyText}>This service could not be found.</Text>
      </SafeAreaView>
    );
  }

  const providerName =
    typeof service.provider === 'object' && service.provider !== null
      ? service.provider.businessName
      : undefined;

  const isBookable = service.availability !== 'Booked Out';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Details</Text>
        <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
          <Text style={{ fontSize: 18 }}>🛒</Text>
          {itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {service.images && service.images.length > 0 ? (
          <Image source={{ uri: service.images[0] }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
            <Text style={{ color: colors.textMuted }}>No image available</Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{service.name}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{service.category}</Text>
            </View>
          </View>

          <Text style={styles.price}>R {service.price.toLocaleString()}</Text>

          <StarRating rating={service.ratingAverage} reviewCount={service.ratingCount} size={13} />

          {providerName && <Text style={styles.soldBy}>Offered by {providerName}</Text>}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{service.description}</Text>

          {service.specs && service.specs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Details</Text>
              <View style={styles.specsTable}>
                {service.specs.map((spec, index) => (
                  <View
                    key={`${spec.key}-${index}`}
                    style={[styles.specRow, index % 2 === 0 && styles.specRowAlt]}
                  >
                    <Text style={styles.specKey}>{spec.key}</Text>
                    <Text style={styles.specValue}>{spec.value}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Duration & Availability</Text>
          <Text style={styles.deliveryText}>⏱ Estimated duration: {service.durationEstimate}</Text>
          <Text
            style={[
              styles.stockText,
              service.availability === 'Available' && { color: colors.success },
              service.availability === 'Booked Out' && { color: colors.danger }
            ]}
          >
            {service.availability}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addToCartButton, (isAdding || !isBookable) && styles.addToCartButtonDisabled]}
          onPress={handleAddToCart}
          disabled={isAdding || !isBookable}
        >
          <Text style={styles.addToCartButtonText}>
            {!isBookable
              ? 'Currently Booked Out'
              : isAdding
                ? 'Adding…'
                : `🛒 Book Service · R ${service.price.toLocaleString()}`}
          </Text>
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
  headerTitle: { ...typography.cardTitle, fontSize: 16, color: colors.textPrimary },
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
  scrollContent: { paddingBottom: 120 },
  heroImage: { width: '100%', height: 220 },
  heroImagePlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { ...typography.title, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  categoryBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4
  },
  categoryBadgeText: { color: colors.accent, fontSize: 11.5, fontWeight: '700' },
  price: { ...typography.price, fontSize: 24, color: colors.accent, marginTop: spacing.sm, marginBottom: spacing.sm },
  soldBy: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  sectionTitle: { ...typography.cardTitle, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.lg },
  description: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20 },
  specsTable: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 11 },
  specRowAlt: { backgroundColor: colors.surface },
  specKey: { color: colors.textMuted, fontSize: 13 },
  specValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  deliveryText: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.xs },
  stockText: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg
  },
  addToCartButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center'
  },
  addToCartButtonDisabled: { opacity: 0.6 },
  addToCartButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' }
});

export default ServiceDetailScreen;
