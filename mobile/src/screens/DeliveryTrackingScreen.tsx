import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/PlatformMap';
import MapUnavailableNotice from '../components/MapUnavailableNotice';
import { hasGoogleMapsKey } from '../utils/mapsConfig';
import { useAuth } from '../context/AuthContext';
import { useEHailingEvents } from '../context/EHailingSocketContext';
import * as deliveryApi from '../api/deliveryApi';
import { isTestPaymentEnabled } from '../api/testPaymentApi';
import { getOrderById } from '../api/orderApi';
import { geocodeAddress, getDirections } from '../api/locationApi';
import { decodePolyline } from '../utils/polyline';
import { estimateEtaMinutes } from '../utils/geo';
import { Delivery } from '../types/delivery';
import { Order } from '../types/marketplace';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DeliveryTracking'>;

const STATUS_COPY: Record<string, { title: string; subtitle: string }> = {
  pending: { title: 'Finding a driver…', subtitle: 'Payment received. We are matching your order with an available driver — this screen updates automatically the moment one accepts. If it takes a while, no driver may be online yet; your delivery stays queued and drivers will see it as soon as they go online.' },
  accepted: { title: 'Driver Assigned', subtitle: 'Your driver is heading to the shop to collect your order.' },
  picked_up: { title: 'On the Way', subtitle: 'Your order has been picked up and is on its way to you.' },
  delivered: { title: 'Delivered!', subtitle: 'Your order has arrived.' },
  return_to_shop: { title: 'Delivery not completed', subtitle: 'The delivery code was entered incorrectly 3 times, so the driver is taking your order back to the shop. Our team will contact you about next steps.' },
  returned: { title: 'Order returned to the shop', subtitle: 'Your order is back with the shop. Our team will contact you about next steps.' }
};

const DeliveryTrackingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId } = route.params;
  const { user } = useAuth();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const driverLocationRef = React.useRef(driverLocation);
  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);
  const [destCoord, setDestCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [eta, setEta] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Distinguishes "this order has no items to physically deliver" (service
  // booking — provider comes to the client) from "something's actually
  // wrong" — the two look identical from a 404 alone, so we check the order
  // itself to tell them apart and show the right message for each.
  const [isServiceOrder, setIsServiceOrder] = useState(false);
  const [testTools, setTestTools] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  useEffect(() => {
    isTestPaymentEnabled().then(setTestTools);
  }, []);

  const loadDelivery = useCallback(async () => {
    try {
      const data = await deliveryApi.getDeliveryByOrder(orderId);
      setDelivery(data);
      setNotFound(false);
      if (data.driver?.driver_location) setDriverLocation(data.driver.driver_location);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setNotFound(true);
        try {
          const order: Order = await getOrderById(orderId);
          const hasProducts = order.items.some((item) => item.itemType === 'product');
          setIsServiceOrder(!hasProducts);
        } catch (orderError) {
          console.warn('Failed to load order while checking delivery type', orderError);
        }
      } else {
        console.warn('Failed to load delivery', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadDelivery();
    // Light polling fallback in case the socket connection drops.
    const interval = setInterval(loadDelivery, 8000);
    return () => clearInterval(interval);
  }, [loadDelivery]);

  // dropoffAddress is free text — Delivery.js has no coordinates for it
  // at all, so it has to be geocoded before any ETA or route can be
  // computed. Only needs to happen once per delivery, the address
  // doesn't change mid-delivery.
  useEffect(() => {
    if (!delivery?.dropoffAddress || destCoord) return;
    geocodeAddress(delivery.dropoffAddress)
      .then((result) => setDestCoord({ latitude: result.latitude, longitude: result.longitude }))
      .catch(() => {
        // No key configured, or the address didn't resolve — ETA/route
        // just won't show, rather than blocking the rest of the screen.
      });
  }, [delivery?.dropoffAddress, destCoord]);

  useEffect(() => {
    if (!destCoord) {
      setRouteCoords([]);
      return;
    }

    let cancelled = false;
    const fetchRouteAndEta = () => {
      const currentDriverLocation = driverLocationRef.current;
      if (!currentDriverLocation) return;

      const minutes = estimateEtaMinutes(currentDriverLocation, destCoord);
      if (!cancelled) setEta(minutes === 1 ? '~1 min' : `~${minutes} min`);

      getDirections(currentDriverLocation, destCoord)
        .then((result) => {
          if (!cancelled) setRouteCoords(decodePolyline(result.encodedPolyline));
        })
        .catch(() => {
          if (!cancelled) setRouteCoords([]);
        });
    };

    fetchRouteAndEta();
    const interval = setInterval(fetchRouteAndEta, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destCoord?.latitude, destCoord?.longitude]);

  useEHailingEvents({
    onDeliveryAccepted: (updated: Delivery) => setDelivery(updated),
    onDeliveryLocationUpdate: (data) => {
      const newLoc = { latitude: data.latitude, longitude: data.longitude };
      setDriverLocation(newLoc);
      if (destCoord) {
        const minutes = estimateEtaMinutes(newLoc, destCoord);
        setEta(minutes === 1 ? '~1 min' : `~${minutes} min`);
      }
    },
    onDeliveryPickedUp: () => setDelivery((prev) => (prev ? { ...prev, status: 'picked_up' } : prev)),
    onDeliveryCompleted: () => setDelivery((prev) => (prev ? { ...prev, status: 'delivered' } : prev)),
    onDeliveryReturnToShop: () => loadDelivery(),
    onDeliveryReturned: () => loadDelivery()
  });

  const openDirections = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => {});
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !delivery) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          {isServiceOrder ? (
            <>
              <Text style={styles.serviceIcon}>🔧</Text>
              <Text style={styles.title}>No Delivery Needed</Text>
              <Text style={styles.subtitle}>
                This order is for a service, not a physical delivery. The service provider will
                come to you directly to carry out the work — check your order details for their
                contact information and any updates.
              </Text>
            </>
          ) : (
            <Text style={styles.subtitle}>This order doesn't have a delivery to track yet.</Text>
          )}
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.navigate('OrderConfirmation', { orderId })}
          >
            <Text style={styles.doneButtonText}>View Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const copy = STATUS_COPY[delivery.status] || STATUS_COPY.pending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Delivery</Text>
        <View style={{ width: 24 }} />
      </View>

      {!hasGoogleMapsKey() ? (
        <View style={styles.map}>
          <MapUnavailableNotice subtitle={delivery.dropoffAddress} />
        </View>
      ) : driverLocation ? (
        <MapView
          provider={PROVIDER_GOOGLE}
          googleMapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as any}
          style={styles.map}
          initialRegion={{ ...driverLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        >
          <Marker coordinate={driverLocation} title={delivery.driver?.driver_name || 'Driver'}>
            <View style={styles.driverMarker}>
              <Text style={{ color: 'white', fontWeight: '700' }}>🚚</Text>
            </View>
          </Marker>
          {destCoord && <Marker coordinate={destCoord} title="Drop-off" pinColor={colors.accent} />}
          {destCoord && (
            <Polyline
              coordinates={routeCoords.length > 1 ? routeCoords : [driverLocation, destCoord]}
              strokeColor={colors.accent}
              strokeWidth={3}
              lineDashPattern={routeCoords.length > 1 ? undefined : [6, 4]}
            />
          )}
        </MapView>
      ) : (
        <View style={[styles.map, styles.mapPlaceholder]}>
          <Text style={{ color: colors.textMuted }}>Waiting for driver location…</Text>
        </View>
      )}

      {eta && delivery.status !== 'delivered' && (
        <View style={styles.etaBanner}>
          <Text style={styles.etaBannerText}>ETA: {eta}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        {delivery.deliveryCode && (delivery.status === 'accepted' || delivery.status === 'picked_up') && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.accent }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center' }}>
              Your delivery code — give it to the driver ONLY when you are holding your order
            </Text>
            <Text style={{ color: colors.accent, fontSize: 36, fontWeight: '800', letterSpacing: 10, marginTop: 4 }}>
              {delivery.deliveryCode}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
              The driver has 3 attempts to enter it. After that the order goes back to the shop.
            </Text>
          </View>
        )}

        {delivery.driver && (
          <View style={styles.driverRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{delivery.driver.driver_name}</Text>
              <Text style={styles.driverVehicle}>{delivery.driver.driver_vehicle}</Text>
            </View>
          </View>
        )}

        {testTools && delivery.status !== 'delivered' && (
          <TouchableOpacity
            disabled={isAdvancing}
            onPress={async () => {
              setIsAdvancing(true);
              try {
                setDelivery(await deliveryApi.testAdvanceDelivery(delivery._id));
              } catch (e) {
                console.warn('Test advance failed', e);
              } finally {
                setIsAdvancing(false);
              }
            }}
            style={{ backgroundColor: '#FACC15', padding: 12, borderRadius: 10, alignItems: 'center', marginVertical: 8, opacity: isAdvancing ? 0.6 : 1 }}
          >
            <Text style={{ color: '#111827', fontWeight: '700' }}>
              TESTER: simulate next step (
              {delivery.status === 'pending' ? 'driver accepts' : delivery.status === 'accepted' ? 'picked up' : 'delivered'})
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.addressRow} onPress={() => openDirections(delivery.pickupAddress)}>
          <Text style={styles.addressLabel}>📦 Pickup</Text>
          <Text style={styles.addressText}>{delivery.pickupAddress}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addressRow} onPress={() => openDirections(delivery.dropoffAddress)}>
          <Text style={styles.addressLabel}>🏁 Drop-off</Text>
          <Text style={styles.addressText}>{delivery.dropoffAddress}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  serviceIcon: { fontSize: 48, marginBottom: spacing.md },
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
  map: { width: '100%', height: 260 },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  etaBanner: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  etaBannerText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  card: { padding: spacing.lg },
  title: { ...typography.title, fontSize: 20, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: 13.5, marginBottom: spacing.lg, lineHeight: 20, textAlign: 'center' },
  driverRow: { flexDirection: 'row', marginBottom: spacing.md },
  driverName: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  driverVehicle: { color: colors.textMuted, fontSize: 12.5 },
  addressRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  addressLabel: { color: colors.accent, fontSize: 11.5, fontWeight: '700', marginBottom: 2 },
  addressText: { color: colors.textPrimary, fontSize: 13.5 },
  driverMarker: {
    backgroundColor: '#142035',
    borderRadius: 50,
    padding: 8,
    borderWidth: 2,
    borderColor: '#F97316'
  },
  doneButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
    width: '100%',
    alignItems: 'center'
  },
  doneButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.sm,
    width: '100%',
    alignItems: 'center'
  },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '700', fontSize: 15 }
});

export default DeliveryTrackingScreen;