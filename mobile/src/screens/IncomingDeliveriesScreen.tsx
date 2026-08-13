import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/PlatformMap';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { useEHailingEvents } from '../context/EHailingSocketContext';
import * as deliveryApi from '../api/deliveryApi';
import { Delivery } from '../types/delivery';

type Props = NativeStackScreenProps<RootStackParamList, 'IncomingDeliveries'>;

const IncomingDeliveriesScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  const [pending, setPending] = useState<Delivery[]>([]);
  const [active, setActive] = useState<Delivery | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const mapRef = useRef<MapView>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setDriverLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (err) {
        console.warn('Location unavailable', err);
      }
    })();
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const data = await deliveryApi.getPendingDeliveries();
      setPending(data);
    } catch (error) {
      console.warn('Failed to load pending deliveries', error);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  // Resume an in-progress delivery — the endpoint and API wrapper for
  // this already existed (getMyActiveDelivery), but nothing actually
  // called it on mount, so closing the app mid-delivery left no way
  // back to it. Same gap already found and fixed for roadside
  // assistance's driver screen.
  useEffect(() => {
    (async () => {
      try {
        const existingActive = await deliveryApi.getMyActiveDelivery();
        if (existingActive) {
          setActive(existingActive);
          startLocationBroadcast(existingActive);
        }
      } catch (error) {
        console.warn('Failed to check for an active delivery', error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewDelivery = useCallback((delivery: Delivery) => {
    setPending((prev) => (prev.find((d) => d._id === delivery._id) ? prev : [delivery, ...prev]));
  }, []);

  const handleDeliveryTaken = useCallback(({ delivery_id }: { delivery_id: string }) => {
    setPending((prev) => prev.filter((d) => d._id !== delivery_id));
  }, []);

  const { emitDeliveryLocation } = useEHailingEvents({
    onNewDelivery: handleNewDelivery,
    onDeliveryTaken: handleDeliveryTaken
  });

  const startLocationBroadcast = (delivery: Delivery) => {
    locationIntervalRef.current = setInterval(() => {
      if (driverLocation) {
        emitDeliveryLocation(delivery._id, delivery.client, driverLocation.latitude, driverLocation.longitude);
        deliveryApi.updateDeliveryLocation(delivery._id, driverLocation).catch(() => {});
      }
    }, 4000);
  };

  const handleAccept = async (delivery: Delivery) => {
    setIsAccepting(true);
    try {
      const accepted = await deliveryApi.acceptDelivery(delivery._id, {
        driver_location: driverLocation || undefined
      });
      setPending((prev) => prev.filter((d) => d._id !== delivery._id));
      setActive(accepted);
      startLocationBroadcast(accepted);
    } catch (error: any) {
      showAlert('Could Not Accept', error?.response?.data?.message || 'This delivery may already be taken');
      loadPending();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleMarkPickedUp = async () => {
    if (!active) return;
    try {
      const updated = await deliveryApi.markPickedUp(active._id);
      setActive(updated);
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.message || 'Could not update status');
    }
  };

  const handleMarkDelivered = () => {
    if (!active) return;
    showAlert('Confirm Delivery', 'Mark this as delivered to the client?', [
      { text: 'Not yet' },
      {
        text: 'Delivered',
        onPress: async () => {
          try {
            await deliveryApi.markDelivered(active._id);
            if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
            setActive(null);
            loadPending();
          } catch (error: any) {
            showAlert('Error', error?.response?.data?.message || 'Could not mark as delivered');
          }
        }
      }
    ]);
  };

  if (active) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A1628' }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          googleMapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as any}
          style={{ flex: 1 }}
          initialRegion={
            driverLocation
              ? { ...driverLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }
              : undefined
          }
        >
          {driverLocation && (
            <Marker coordinate={driverLocation} title="You">
              <View style={styles.driverMarkerIcon}>
                <Text style={{ color: 'white', fontWeight: '700' }}>🚚</Text>
              </View>
            </Marker>
          )}
        </MapView>

        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>
            {active.status === 'accepted' ? 'Head to the shop' : 'Delivering to client'}
          </Text>

          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>📦 Pickup (Shop)</Text>
            <Text style={styles.addressText}>{active.pickupAddress}</Text>
          </View>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>🏁 Drop-off (Client)</Text>
            <Text style={styles.addressText}>{active.dropoffAddress}</Text>
          </View>

          {active.items.map((item, idx) => (
            <Text key={idx} style={styles.itemText}>
              {item.quantity} x {item.nameSnapshot}
            </Text>
          ))}

          {active.status === 'accepted' ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleMarkPickedUp}>
              <Text style={styles.primaryButtonText}>Picked Up from Shop</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.successButton} onPress={handleMarkDelivered}>
              <Text style={styles.primaryButtonText}>Mark Delivered</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A1628' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery Jobs</Text>
        <View style={{ width: 24 }} />
      </View>

      {pending.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No deliveries right now</Text>
          <Text style={styles.emptySubtext}>New jobs will appear here instantly.</Text>
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.jobCard}>
              <Text style={styles.jobTitle}>R {item.totalAmount.toLocaleString()} delivery</Text>
              <Text style={styles.jobAddress}>📦 {item.pickupAddress}</Text>
              <Text style={styles.jobAddress}>🏁 {item.dropoffAddress}</Text>
              {item.items.map((line, idx) => (
                <Text key={idx} style={styles.itemText}>
                  {line.quantity} x {line.nameSnapshot}
                </Text>
              ))}
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => handleAccept(item)}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.acceptBtnText}>Accept Delivery</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 56,
    backgroundColor: '#142035'
  },
  backArrow: { color: 'white', fontSize: 20 },
  headerTitle: { color: 'white', fontWeight: '700', fontSize: 17 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#6B7280', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#4B5563', fontSize: 14 },
  jobCard: {
    backgroundColor: '#142035',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F'
  },
  jobTitle: { color: '#F97316', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  jobAddress: { color: '#D1D5DB', fontSize: 13, marginBottom: 4 },
  itemText: { color: '#9CA3AF', fontSize: 12.5, marginTop: 2 },
  acceptBtn: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12
  },
  acceptBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  driverMarkerIcon: {
    backgroundColor: '#142035',
    borderRadius: 50,
    padding: 8,
    borderWidth: 2,
    borderColor: '#F97316'
  },
  activeCard: {
    backgroundColor: '#142035',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36
  },
  activeTitle: { color: 'white', fontWeight: '700', fontSize: 18, marginBottom: 14 },
  addressBlock: { marginBottom: 10 },
  addressLabel: { color: '#F97316', fontSize: 12.5, fontWeight: '700', marginBottom: 2 },
  addressText: { color: '#D1D5DB', fontSize: 14 },
  primaryButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
    borderWidth: 2,
    borderColor: '#F97316'
  },
  successButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14
  },
  primaryButtonText: { color: 'white', fontWeight: '700', fontSize: 15 }
});

export default IncomingDeliveriesScreen;