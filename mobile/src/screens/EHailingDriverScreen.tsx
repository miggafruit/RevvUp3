// src/screens/EHailingDriverScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Vibration,
  Animated,
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/PlatformMap';

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useEHailingEvents } from '../context/EHailingSocketContext';
import {
  getPendingRequests,
  acceptRequest,
  markArrived,
  completeRequest,
  updateDriverLocation,
  getHistory,
} from '../api/ehailingApi';
import { LIVE_RIDE_STATUSES } from '../constants/roadsideServices';
import { getDirections } from '../api/locationApi';
import { decodePolyline } from '../utils/polyline';

// ─── Types ────────────────────────────────────────────────────────────────────

type RideRequest = {
  id: string;
  client: { _id: string; name: string; phone: string };
  driver?: {
    driver_id: string;
    driver_name: string;
    driver_phone: string;
    driver_vehicle: string;
    driver_location?: { latitude: number; longitude: number };
  };
  serviceType: string;
  location: { address: string; latitude?: number; longitude?: number };
  vehicleDetails: { make: string; model: string; licensePlate: string };
  issueDescription: string;
  forSomeoneElse: boolean;
  beneficiaryName?: string;
  status: string;
  createdAt: string;
};

type DriverMode = 'online' | 'en_route' | 'on_scene' | 'completed';

const SERVICE_ICONS: Record<string, string> = {
  towing: 'truck',
  jump_start: 'lightning-bolt',
  tire_change: 'tire',
  fuel_delivery: 'gas-station',
  lockout: 'key',
  other: 'wrench',
};

const SERVICE_LABELS: Record<string, string> = {
  towing: 'Towing',
  jump_start: 'Jump Start',
  tire_change: 'Tire Change',
  fuel_delivery: 'Fuel Delivery',
  lockout: 'Lockout',
  other: 'Other',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function EHailingDriverScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const incomingRequest = route.params?.incomingRequest;

  const [mode, setMode] = useState<DriverMode>('online');
  const [pendingRequests, setPendingRequests] = useState<RideRequest[]>(
    incomingRequest ? [incomingRequest] : []
  );
  const [activeRequest, setActiveRequest] = useState<RideRequest | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const driverLocationRef = useRef(driverLocation);
  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);

  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  // Real road route between the driver and the job's location — this
  // has to live at the top level (not inside the map's render branch)
  // since it feeds a useEffect below, and hooks can't live inside a
  // conditionally-rendered block.
  const destCoord = activeRequest?.location.latitude
    ? { latitude: activeRequest.location.latitude, longitude: activeRequest.location.longitude! }
    : null;

  useEffect(() => {
    if (!destCoord) {
      setRouteCoords([]);
      return;
    }

    let cancelled = false;
    const fetchRoute = () => {
      // Reads the ref, not the closed-over driverLocation value — this
      // effect intentionally doesn't re-run on every ~4s GPS ping (see
      // dependency array below), so without the ref, this interval's
      // callback would keep using whatever position the driver was at
      // when the effect first ran, forever, never actually reflecting
      // where they've since moved to.
      const currentDriverLocation = driverLocationRef.current;
      if (!currentDriverLocation) return;
      getDirections(currentDriverLocation, destCoord)
        .then((result) => {
          if (!cancelled) setRouteCoords(decodePolyline(result.encodedPolyline));
        })
        .catch(() => {
          // No key configured, or the request failed — the map falls
          // back to a straight line between the two points rather than
          // showing nothing.
          if (!cancelled) setRouteCoords([]);
        });
    };

    fetchRoute();
    // Refetch periodically rather than on every ~4s GPS ping — a full
    // route recalculation doesn't meaningfully change that often, and
    // hitting the Directions API every few seconds would be wasteful.
    const interval = setInterval(fetchRoute, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRequest?.id, destCoord?.latitude, destCoord?.longitude]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [earnings, setEarnings] = useState(0);

  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Location watch ──────────────────────────────────────────────────────────

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          // No permission — set a fallback so map still renders
          setDriverLocation({ latitude: -26.1952, longitude: 28.0339 });
          return;
        }
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
          (loc) => {
            setDriverLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        );
        locationWatchRef.current = sub;
      } catch (err) {
        console.warn('Location unavailable, using default:', err);
        setDriverLocation({ latitude: -26.1952, longitude: 28.0339 });
      }
    })();

    return () => {
      locationWatchRef.current?.remove();
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, []);

  // ── Socket ──────────────────────────────────────────────────────────────────

  const handleNewRequest = useCallback((request: RideRequest) => {
    Vibration.vibrate([0, 200, 100, 200]);
    setPendingRequests((prev) => {
      if (prev.find((r) => r.id === request.id)) return prev;
      return [request, ...prev];
    });
  }, []);

  const handleRequestTaken = useCallback(({ request_id }: { request_id: string }) => {
    setPendingRequests((prev) => prev.filter((r) => r.id !== request_id));
  }, []);

  const handleAssignedCancelled = useCallback(
    ({ request_id }: { request_id: string }) => {
      if (activeRequest?.id === request_id) {
        showAlert('Cancelled', 'The client has cancelled this request.');
        if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
        setActiveRequest(null);
        setMode('online');
      }
    },
    [activeRequest]
  );

  const { emitDriverLocation } = useEHailingEvents({
    onNewRequest: handleNewRequest,
    onRequestTaken: handleRequestTaken,
    onAssignedRequestCancelled: handleAssignedCancelled,
  });

  // ── Fetch pending on mount ───────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await getPendingRequests();
        const fetched: RideRequest[] = res.data ?? [];
        if (incomingRequest && !fetched.find((r) => r.id === incomingRequest.id)) {
          setPendingRequests([incomingRequest, ...fetched]);
        } else {
          setPendingRequests(fetched);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resume an existing active job ────────────────────────────────────────
  // If this driver already has a job in progress (accepted/in_progress)
  // from before the app was closed or this screen was left, load it back
  // instead of leaving them stuck on the pending-jobs list with no way
  // to see what they're actually supposed to be doing right now. Mirrors
  // the same auto-resume pattern already built for clients.

  useEffect(() => {
    (async () => {
      try {
        const res = await getHistory();
        const items: RideRequest[] = res.data ?? [];
        const active = items.find(
          (r) => LIVE_RIDE_STATUSES.includes(r.status) && r.driver?.driver_id === user?.id
        );
        if (active) {
          setActiveRequest(active);
          setMode(active.status === 'in_progress' ? 'on_scene' : 'en_route');
          startLocationBroadcast(active);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (mode === 'online') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [mode]);

  // ── Location broadcast ────────────────────────────────────────────────────

  const startLocationBroadcast = (request: RideRequest) => {
    locationIntervalRef.current = setInterval(() => {
      if (driverLocation) {
        emitDriverLocation(
          request.id,
          request.client._id,
          driverLocation.latitude,
          driverLocation.longitude
        );
        updateDriverLocation(request.id, driverLocation).catch(() => {});
      }
    }, 4000);
  };

  // ── Accept job ───────────────────────────────────────────────────────────

  const handleAccept = async (request: RideRequest) => {
    setIsAccepting(true);
    try {
      await acceptRequest(request.id, {
        driver_location: driverLocation ?? undefined,
      });
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
      setActiveRequest(request);
      setMode('en_route');
      startLocationBroadcast(request);

      if (driverLocation && request.location.latitude && mapRef.current) {
        mapRef.current.fitToCoordinates(
          [driverLocation, { latitude: request.location.latitude!, longitude: request.location.longitude! }],
          { edgePadding: { top: 80, right: 60, bottom: 200, left: 60 }, animated: true }
        );
      }
    } catch {
      showAlert('Already taken', 'Someone else accepted this job first.');
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    } finally {
      setIsAccepting(false);
    }
  };

  const handleArrived = async () => {
    if (!activeRequest) return;
    try {
      await markArrived(activeRequest.id);
      setMode('on_scene');
    } catch {
      showAlert('Error', 'Could not update status.');
    }
  };

  const handleComplete = () => {
    showAlert('Complete Job', 'Mark this job as completed?', [
      { text: 'Not yet' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            await completeRequest(activeRequest!.id);
            if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
            setJobsCompleted((n) => n + 1);
            setEarnings((n) => n + 350);
            setMode('completed');
          } catch {
            showAlert('Error', 'Could not complete job.');
          }
        },
      },
    ]);
  };

  // ── Render: Job card ────────────────────────────────────────────────────

  const renderRequestCard = ({ item }: { item: RideRequest }) => {
    const timeAgo = Math.round((Date.now() - new Date(item.createdAt).getTime()) / 60000);
    return (
      <View style={styles.requestCard}>
        <View style={styles.cardTop}>
          <View style={styles.serviceIcon}>
            <MaterialCommunityIcons
              name={(SERVICE_ICONS[item.serviceType] ?? 'wrench') as any}
              size={24}
              color="#F97316"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.serviceLabel}>{SERVICE_LABELS[item.serviceType] ?? 'Service'}</Text>
            <Text style={styles.clientName}>{item.client?.name}</Text>
          </View>
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText}>{timeAgo}m ago</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={16} color="#9CA3AF" />
          <Text style={styles.infoText} numberOfLines={1}>{item.location.address}</Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="car-outline" size={16} color="#9CA3AF" />
          <Text style={styles.infoText}>
            {[item.vehicleDetails?.make, item.vehicleDetails?.model, item.vehicleDetails?.licensePlate]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>

        {!!item.issueDescription && (
          <Text style={styles.issueText} numberOfLines={2}>"{item.issueDescription}"</Text>
        )}

        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => handleAccept(item)}
          disabled={isAccepting}
          activeOpacity={0.85}
        >
          {isAccepting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.acceptBtnText}>Accept Job</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ── Render: Completed ──────────────────────────────────────────────────

  if (mode === 'completed') {
    return (
      <View style={styles.centeredScreen}>
        <MaterialCommunityIcons name="check-decagram" size={90} color="#22c55e" />
        <Text style={styles.bigTitle}>Job Complete!</Text>
        <Text style={styles.subText}>Great work. The client has been sorted.</Text>
        <View style={styles.earningBox}>
          <Text style={styles.earningLabel}>Estimated Payout</Text>
          <Text style={styles.earningAmount}>R{earnings}</Text>
        </View>
        <TouchableOpacity
          style={styles.greenBtn}
          onPress={() => { setActiveRequest(null); setMode('online'); }}
        >
          <Text style={styles.greenBtnText}>Find Next Job</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: Map (en route / on scene) ─────────────────────────────────

  if (mode === 'en_route' || mode === 'on_scene') {
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
                <MaterialCommunityIcons name="truck" size={24} color="white" />
              </View>
            </Marker>
          )}
          {destCoord && (
            <Marker coordinate={destCoord} title="Client">
              <MaterialCommunityIcons name="map-marker" size={38} color="#F97316" />
            </Marker>
          )}
          {driverLocation && destCoord && (
            <Polyline
              coordinates={routeCoords.length > 1 ? routeCoords : [driverLocation, destCoord]}
              strokeColor="#F97316"
              strokeWidth={3}
              lineDashPattern={routeCoords.length > 1 ? undefined : [6, 4]}
            />
          )}
        </MapView>

        <View style={styles.activeJobCard}>
          <Text style={styles.activeJobTitle}>
            {mode === 'on_scene' ? "You've arrived 🎉" : 'En Route'}
          </Text>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="map-marker" size={18} color="#F97316" />
            <Text style={styles.activeJobAddress} numberOfLines={2}>
              {activeRequest?.location.address}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="user" size={16} color="#9CA3AF" />
            <Text style={styles.infoText}>
              {activeRequest?.client?.name} · {activeRequest?.client?.phone}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="car" size={16} color="#9CA3AF" />
            <Text style={styles.infoText}>
              {activeRequest?.vehicleDetails?.make} {activeRequest?.vehicleDetails?.model}{' '}
              · {activeRequest?.vehicleDetails?.licensePlate}
            </Text>
          </View>

          {mode === 'en_route' ? (
            <TouchableOpacity style={styles.arrivedBtn} onPress={handleArrived} activeOpacity={0.85}>
              <Text style={styles.arrivedBtnText}>I've Arrived</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.completeBtn} onPress={handleComplete} activeOpacity={0.85}>
              <MaterialCommunityIcons name="check-circle" size={20} color="white" />
              <Text style={styles.completeBtnText}>  Mark Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Render: Online / job list ──────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#0A1628' }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Text style={{ color: '#9CA3AF', fontSize: 15 }}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>
            Hello, {user?.name?.split(' ')[0] ?? 'Provider'} 👋
          </Text>
          <Text style={styles.headerSub}>{user?.businessName ?? 'Service Provider'}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{jobsCompleted}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>R{earnings}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
        </View>
      </View>

      <View style={styles.onlineBanner}>
        <Animated.View style={[styles.onlineDot, { transform: [{ scale: pulseAnim }] }]} />
        <Text style={styles.onlineText}>Online — waiting for jobs</Text>
      </View>

      {pendingRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="satellite-uplink" size={64} color="#374151" />
          <Text style={styles.emptyTitle}>No jobs nearby yet</Text>
          <Text style={styles.emptySubtext}>New requests will appear here instantly.</Text>
        </View>
      ) : (
        <FlatList
          data={pendingRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#142035',
    padding: 20,
    paddingTop: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: { fontSize: 20, fontWeight: '700', color: 'white' },
  headerSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: {
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  statValue: { color: '#F97316', fontWeight: '700', fontSize: 16 },
  statLabel: { color: '#9CA3AF', fontSize: 11 },
  onlineBanner: {
    backgroundColor: '#142035',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  onlineText: { color: '#22c55e', fontWeight: '600', fontSize: 14 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { color: '#6B7280', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#4B5563', fontSize: 14 },
  requestCard: {
    backgroundColor: '#142035',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  serviceIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center',
  },
  serviceLabel: { color: '#F97316', fontWeight: '700', fontSize: 16 },
  clientName: { color: '#D1D5DB', fontSize: 13, marginTop: 2 },
  timeBadge: { backgroundColor: '#1E3A5F', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  timeBadgeText: { color: '#9CA3AF', fontSize: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoText: { color: '#9CA3AF', fontSize: 13, flex: 1 },
  issueText: { color: '#6B7280', fontSize: 13, fontStyle: 'italic', marginVertical: 6 },
  acceptBtn: {
    backgroundColor: '#F97316', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', marginTop: 10,
  },
  acceptBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  activeJobCard: {
    backgroundColor: '#142035', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    shadowColor: '#000', shadowOpacity: 0.5, shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12, elevation: 14,
  },
  activeJobTitle: { color: 'white', fontWeight: '700', fontSize: 20, marginBottom: 14 },
  activeJobAddress: { color: '#D1D5DB', fontSize: 14, flex: 1 },
  arrivedBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 14, borderWidth: 2, borderColor: '#F97316',
  },
  arrivedBtnText: { color: '#F97316', fontWeight: '700', fontSize: 15 },
  completeBtn: {
    backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14,
  },
  completeBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  driverMarkerIcon: {
    backgroundColor: '#142035', borderRadius: 50, padding: 8,
    borderWidth: 2, borderColor: '#F97316',
  },
  centeredScreen: {
    flex: 1, backgroundColor: '#0A1628',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  bigTitle: { fontSize: 26, fontWeight: 'bold', color: 'white', marginTop: 20, textAlign: 'center' },
  subText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 10 },
  earningBox: {
    backgroundColor: '#142035', borderRadius: 16,
    paddingVertical: 20, paddingHorizontal: 40, marginTop: 28,
    alignItems: 'center', borderWidth: 1, borderColor: '#22c55e',
  },
  earningLabel: { color: '#9CA3AF', fontSize: 13 },
  earningAmount: { color: '#22c55e', fontSize: 36, fontWeight: '800', marginTop: 4 },
  greenBtn: {
    backgroundColor: '#22c55e', paddingVertical: 14,
    paddingHorizontal: 32, borderRadius: 14, marginTop: 28,
  },
  greenBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});