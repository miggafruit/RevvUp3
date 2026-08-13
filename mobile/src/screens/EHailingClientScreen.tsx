// src/screens/EHailingClientScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Vibration,
} from 'react-native';
import SelectModal, { SelectOption } from '../components/SelectModal';
import { showAlert } from '../utils/crossPlatformAlert';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/PlatformMap';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { useEHailingEvents } from '../context/EHailingSocketContext';
import { createRideRequest, cancelRequest, getTowEstimate, TowEstimate, getRequest, getHistory } from '../api/ehailingApi';
import { LIVE_RIDE_STATUSES } from '../constants/roadsideServices';
import { estimateEtaMinutes } from '../utils/geo';
import { searchPlaces, getPlaceDetails, reverseGeocode, getDirections, PlacePrediction } from '../api/locationApi';
import { decodePolyline } from '../utils/polyline';

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = {
  service_type: string;
  address: string;
  make: string;
  model: string;
  license_plate: string;
  issue_description: string;
  for_someone_else: boolean;
  beneficiary_name: string;
  beneficiary_phone: string;
};

type RequestStatus = 'idle' | 'submitting' | 'searching' | 'accepted' | 'in_progress' | 'completed';

type AcceptedRequest = {
  id: string;
  client: { _id: string; name: string; phone: string };
  driver: {
    driver_name: string;
    driver_phone: string;
    driver_vehicle: string;
    driver_location: { latitude: number; longitude: number };
  };
  status: string;
};

const SERVICE_LABELS: Record<string, string> = {
  tow_sling: 'Towing (Sling)',
  tow_rollback: 'Towing (Rollback)',
  jump_start: 'Jump Start',
  tire_change: 'Tire Change',
  fuel_delivery: 'Fuel Delivery',
  lockout: 'Lockout Service',
  other: 'Other',
};

const TOW_SERVICE_TYPES = ['tow_sling', 'tow_rollback'];

const SERVICE_OPTIONS: SelectOption[] = [
  { label: '🚚  Towing (Sling)', value: 'tow_sling' },
  { label: '🚛  Towing (Rollback)', value: 'tow_rollback' },
  { label: '⚡  Jump Start', value: 'jump_start' },
  { label: '🔧  Tire Change', value: 'tire_change' },
  { label: '⛽  Fuel Delivery', value: 'fuel_delivery' },
  { label: '🔑  Lockout Service', value: 'lockout' },
  { label: '❓  Other', value: 'other' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EHailingClientScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [form, setForm] = useState<FormData>({
    service_type: '',
    address: '',
    make: '',
    model: '',
    license_plate: '',
    issue_description: '',
    for_someone_else: false,
    beneficiary_name: '',
    beneficiary_phone: '',
  });

  const [status, setStatus] = useState<RequestStatus>('idle');
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [isServicePickerVisible, setIsServicePickerVisible] = useState(false);
  const [acceptedRequest, setAcceptedRequest] = useState<AcceptedRequest | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const driverLocationRef = useRef(driverLocation);
  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isResumingRide, setIsResumingRide] = useState(false);

  // Resuming a request — either explicitly (tapped it in history) or
  // automatically (this screen was opened fresh, e.g. from the
  // dashboard, but the client already has a request in flight). Without
  // this, navigating away and back always landed on a blank "request
  // a new job" form with zero awareness that a live request already
  // existed — which is what made it look like tracking had silently
  // broken, when really the screen had just forgotten about it.
  const route = useRoute<any>();
  const resumeRideId: string | undefined = route.params?.resumeRideId;

  const applyRideState = (ride: any) => {
    setCurrentRequestId(ride.id);
    // Resuming never ran the normal booking-form flow, so
    // selectedLocation would otherwise stay null — meaning the ETA
    // target would silently fall back to the client's own GPS position,
    // wrong for a "someone else" request where those differ.
    if (ride.location) {
      setSelectedLocation({
        address: ride.location.address,
        latitude: ride.location.latitude,
        longitude: ride.location.longitude,
      });
    }
    if (ride.status === 'pending') {
      setStatus('searching');
    } else if (ride.status === 'accepted' || ride.status === 'in_progress') {
      setAcceptedRequest(ride);
      const driverLoc = ride.driver?.driver_location ?? null;
      setDriverLocation(driverLoc);
      if (driverLoc && ride.location) {
        const minutes = estimateEtaMinutes(driverLoc, ride.location);
        setEta(minutes === 1 ? '~1 min' : `~${minutes} min`);
      }
      setStatus(ride.status === 'in_progress' ? 'in_progress' : 'accepted');
    } else if (ride.status === 'completed') {
      setStatus('completed');
    }
  };

  useEffect(() => {
    if (resumeRideId) {
      // Explicit — came from tapping a specific item in history.
      setIsResumingRide(true);
      getRequest(resumeRideId)
        .then((res) => {
          const ride = res.data;
          if (LIVE_RIDE_STATUSES.includes(ride.status) || ride.status === 'completed') {
            applyRideState(ride);
          } else {
            showAlert('Request cancelled', 'This request was cancelled.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          }
        })
        .catch(() => {
          showAlert('Error', "Couldn't load this request.", [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        })
        .finally(() => setIsResumingRide(false));
      return;
    }

    // Automatic — this screen was opened fresh (e.g. tapping "Roadside
    // Assistance" from the dashboard), but the client might already
    // have a request in flight from earlier. Check before assuming
    // they want to start a brand new one.
    setIsResumingRide(true);
    getHistory()
      .then((res) => {
        const items: any[] = res.data ?? [];
        const active = items.find((r) => LIVE_RIDE_STATUSES.includes(r.status));
        if (active) applyRideState(active);
      })
      .catch(() => {
        // No history yet, or the check failed — fall through to the
        // normal blank request form. Not worth blocking on.
      })
      .finally(() => setIsResumingRide(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeRideId]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [eta, setEta] = useState<string>('Calculating...');

  // Location search — selectedLocation is the single source of truth
  // for what actually gets sent with the request. locationSource tracks
  // whether it came from GPS or a manual search, so toggling
  // "for someone else" can clear a GPS-sourced default (the requester's
  // own position is wrong for a beneficiary elsewhere) without clobbering
  // an address the user already deliberately searched for.
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; latitude: number; longitude: number } | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'search' | null>(null);
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real routed line from driver to pickup point, mirroring the same
  // fix on the driver's own screen — target is selectedLocation (the
  // ride's actual pickup point), not userLocation, since those differ
  // for a "someone else" request.
  useEffect(() => {
    if (!selectedLocation || status !== 'accepted') {
      setRouteCoords([]);
      return;
    }

    let cancelled = false;
    const fetchRoute = () => {
      const currentDriverLocation = driverLocationRef.current;
      if (!currentDriverLocation) return;
      getDirections(currentDriverLocation, selectedLocation)
        .then((result) => {
          if (!cancelled) setRouteCoords(decodePolyline(result.encodedPolyline));
        })
        .catch(() => {
          if (!cancelled) setRouteCoords([]);
        });
    };

    fetchRoute();
    const interval = setInterval(fetchRoute, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedLocation?.latitude, selectedLocation?.longitude]);

  // Tow-specific — a tow is point-to-point (pickup → delivery point),
  // unlike the other roadside services above which are all "fix it
  // where I am" with a single location. transmissionType also gates
  // which truck types are even selectable (a sling can't tow an
  // automatic — enforced both here and, regardless of what this UI
  // allows, server-side in ehailingController.createRequest).
  const [transmissionType, setTransmissionType] = useState<'manual' | 'automatic' | ''>('');
  const [isAccidentScene, setIsAccidentScene] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationLocation, setDestinationLocation] = useState<{ address: string; latitude: number; longitude: number } | null>(null);
  const [destinationPredictions, setDestinationPredictions] = useState<PlacePrediction[]>([]);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const [isResolvingDestination, setIsResolvingDestination] = useState(false);
  const destinationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [towEstimate, setTowEstimate] = useState<TowEstimate | null>(null);
  const [isFetchingEstimate, setIsFetchingEstimate] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const isTowRequest = TOW_SERVICE_TYPES.includes(form.service_type);

  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Socket ──────────────────────────────────────────────────────────────────

  const handleRequestAccepted = useCallback((request: AcceptedRequest) => {
    if (request.id !== currentRequestId) return;
    Vibration.vibrate([0, 200, 100, 200]);
    setAcceptedRequest(request);
    setDriverLocation(request.driver?.driver_location ?? null);
    setStatus('accepted');
  }, [currentRequestId]);

  const handleDriverLocationUpdate = useCallback(
    (data: { request_id: string; latitude: number; longitude: number }) => {
      if (data.request_id !== currentRequestId) return;
      const newLoc = { latitude: data.latitude, longitude: data.longitude };
      setDriverLocation(newLoc);
      if (userLocation && mapRef.current) {
        mapRef.current.fitToCoordinates([newLoc, userLocation], {
          edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
          animated: true,
        });
      }
      // Target is the ride's actual pickup point (selectedLocation), not
      // the client's own GPS position — those differ whenever the
      // request is for someone else or the client searched a different
      // address than where they're currently standing.
      const target = selectedLocation ?? userLocation;
      if (target) {
        const minutes = estimateEtaMinutes(newLoc, target);
        setEta(minutes === 1 ? '~1 min' : `~${minutes} min`);
      }
    },
    [currentRequestId, userLocation, selectedLocation]
  );

  const handleDriverArrived = useCallback(() => {
    Vibration.vibrate([0, 300, 100, 300]);
    setStatus('in_progress');
  }, []);

  const handleRequestCompleted = useCallback(() => {
    setStatus('completed');
  }, []);

  useEHailingEvents({
    onRequestAccepted: handleRequestAccepted,
    onDriverLocationUpdate: handleDriverLocationUpdate,
    onDriverArrived: handleDriverArrived,
    onRequestCompleted: handleRequestCompleted,
  });

  // ── Location ────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus !== 'granted') {
          setUserLocation({ latitude: -26.1952, longitude: 28.0339 }); // fallback: Johannesburg
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (err) {
        console.warn('Location unavailable, using default:', err);
        setUserLocation({ latitude: -26.1952, longitude: 28.0339 }); // fallback: Johannesburg
      }
    })();
  }, []);

  // Default the location to the requester's own position — but only
  // when this request is for themselves, and only once (a manual
  // search always wins over this default).
  useEffect(() => {
    if (!userLocation || form.for_someone_else || selectedLocation) return;
    reverseGeocode(userLocation.latitude, userLocation.longitude)
      .then((address) => {
        setSelectedLocation({ address, ...userLocation });
        setLocationSource('gps');
        setForm((p) => ({ ...p, address }));
      })
      .catch(() => {
        // Reverse geocoding needs GOOGLE_MAPS_API_KEY configured — if
        // it's not, still let them proceed with a generic label rather
        // than silently blocking the whole flow.
        setSelectedLocation({ address: 'Current location', ...userLocation });
        setLocationSource('gps');
        setForm((p) => ({ ...p, address: 'Current location' }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, form.for_someone_else]);

  // The requester's GPS position is the WRONG location once this
  // becomes a request for someone else — clear a GPS-sourced default
  // so they're prompted to search for where the beneficiary actually
  // is. A location they already searched for manually is left alone.
  useEffect(() => {
    if (form.for_someone_else && locationSource === 'gps') {
      setSelectedLocation(null);
      setLocationSource(null);
      setForm((p) => ({ ...p, address: '' }));
    }
  }, [form.for_someone_else, locationSource]);

  const handleAddressChange = (text: string) => {
    setForm((p) => ({ ...p, address: text }));
    setSelectedLocation(null);
    setLocationSource(null);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (text.trim().length < 3) {
      setPlacePredictions([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const results = await searchPlaces(text, userLocation ?? undefined);
        setPlacePredictions(results);
      } catch {
        setPlacePredictions([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 350);
  };

  const handleSelectPrediction = async (prediction: PlacePrediction) => {
    setPlacePredictions([]);
    setIsResolvingPlace(true);
    try {
      const details = await getPlaceDetails(prediction.placeId);
      setSelectedLocation(details);
      setLocationSource('search');
      setForm((p) => ({ ...p, address: details.address }));
    } catch {
      showAlert('Error', "Couldn't get that location's details, try again.");
    } finally {
      setIsResolvingPlace(false);
    }
  };

  const handleDestinationChange = (text: string) => {
    setDestinationQuery(text);
    setDestinationLocation(null);
    setTowEstimate(null);

    if (destinationDebounceRef.current) clearTimeout(destinationDebounceRef.current);
    if (text.trim().length < 3) {
      setDestinationPredictions([]);
      return;
    }
    destinationDebounceRef.current = setTimeout(async () => {
      setIsSearchingDestination(true);
      try {
        const results = await searchPlaces(text, selectedLocation ?? userLocation ?? undefined);
        setDestinationPredictions(results);
      } catch {
        setDestinationPredictions([]);
      } finally {
        setIsSearchingDestination(false);
      }
    }, 350);
  };

  const handleSelectDestinationPrediction = async (prediction: PlacePrediction) => {
    setDestinationPredictions([]);
    setIsResolvingDestination(true);
    try {
      const details = await getPlaceDetails(prediction.placeId);
      setDestinationLocation(details);
      setDestinationQuery(details.address);
    } catch {
      showAlert('Error', "Couldn't get that location's details, try again.");
    } finally {
      setIsResolvingDestination(false);
    }
  };

  // Live fare preview — refetches whenever any input that affects the
  // price changes, same as Uber/Bolt updating the quoted fare as you
  // adjust pickup/destination. Deliberately does NOT fire for
  // tow_sling + automatic — that combination is invalid (a sling can't
  // tow an automatic) and the UI below blocks selecting it anyway.
  useEffect(() => {
    if (!isTowRequest || !selectedLocation || !destinationLocation || !transmissionType) {
      setTowEstimate(null);
      return;
    }
    if (form.service_type === 'tow_sling' && transmissionType === 'automatic') {
      setTowEstimate(null);
      return;
    }

    setIsFetchingEstimate(true);
    setEstimateError(null);
    getTowEstimate({
      service_type: form.service_type as 'tow_sling' | 'tow_rollback',
      pickupLat: selectedLocation.latitude,
      pickupLng: selectedLocation.longitude,
      destLat: destinationLocation.latitude,
      destLng: destinationLocation.longitude,
      transmission_type: transmissionType,
    })
      .then(setTowEstimate)
      .catch((err) => {
        setTowEstimate(null);
        setEstimateError(err?.response?.data?.message || "Couldn't calculate a fare estimate.");
      })
      .finally(() => setIsFetchingEstimate(false));
  }, [isTowRequest, form.service_type, selectedLocation, destinationLocation, transmissionType]);

  // ── Pulse animation while searching ─────────────────────────────────────────

  useEffect(() => {
    if (status === 'searching') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status]);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.service_type || !selectedLocation || !form.license_plate) {
      showAlert(
        'Missing info',
        !selectedLocation
          ? 'Please search for and select a location.'
          : 'Please fill in service type, address, and license plate.'
      );
      return;
    }
    if (isTowRequest) {
      if (!destinationLocation) {
        showAlert('Missing info', 'Please search for and select where the vehicle should be towed to.');
        return;
      }
      if (!transmissionType) {
        showAlert('Missing info', "Please specify the vehicle's transmission type.");
        return;
      }
      if (form.service_type === 'tow_sling' && transmissionType === 'automatic') {
        showAlert(
          'Wrong truck type',
          'A sling truck can only tow manual-transmission vehicles. Please select Rollback instead.'
        );
        return;
      }
    }
    setStatus('submitting');
    try {
      const res = await createRideRequest({
        service_type: form.service_type,
        location: {
          address: selectedLocation.address,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        },
        destination: isTowRequest && destinationLocation ? {
          address: destinationLocation.address,
          latitude: destinationLocation.latitude,
          longitude: destinationLocation.longitude,
        } : undefined,
        transmission_type: isTowRequest ? (transmissionType || undefined) : undefined,
        is_accident_scene: isTowRequest ? isAccidentScene : undefined,
        vehicle_details: {
          make: form.make,
          model: form.model,
          license_plate: form.license_plate,
        },
        issue_description: form.issue_description,
        for_someone_else: form.for_someone_else,
        beneficiary_name: form.beneficiary_name || undefined,
        beneficiary_phone: form.beneficiary_phone || undefined,
      });
      setCurrentRequestId(res.data.id);
      setStatus('searching');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Could not send your request. Please try again.';
      const unpaidRequestId = error?.response?.data?.unpaidRequestId;

      if (unpaidRequestId) {
        showAlert('Payment needed', message, [
          { text: 'Not now' },
          {
            text: 'Pay Now',
            onPress: () => navigation.navigate('RidePayment', { rideId: unpaidRequestId }),
          },
        ]);
      } else {
        showAlert('Error', message);
      }
      setStatus('idle');
    }
  };

  const handleCancel = () => {
    if (!currentRequestId) return;
    showAlert('Cancel Request', 'Are you sure you want to cancel?', [
      { text: 'No' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try { await cancelRequest(currentRequestId); } catch {}
          setStatus('idle');
          setCurrentRequestId(null);
          setAcceptedRequest(null);
        },
      },
    ]);
  };

  const resetForm = () => {
    setForm({
      service_type: '',
      address: '',
      make: '',
      model: '',
      license_plate: '',
      issue_description: '',
      for_someone_else: false,
      beneficiary_name: '',
      beneficiary_phone: '',
    });
    setStatus('idle');
    setCurrentRequestId(null);
    setAcceptedRequest(null);
    setDriverLocation(null);
    setSelectedLocation(null);
    setLocationSource(null);
    setPlacePredictions([]);
    setTransmissionType('');
    setIsAccidentScene(false);
    setDestinationQuery('');
    setDestinationLocation(null);
    setDestinationPredictions([]);
    setTowEstimate(null);
    setEstimateError(null);
  };

  // ── Resuming from history ─────────────────────────────────────────────────

  if (isResumingRide) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.subText}>Loading your request...</Text>
      </View>
    );
  }

  // ── Completed ───────────────────────────────────────────────────────────────

  if (status === 'completed') {
    return (
      <View style={styles.centeredScreen}>
        <MaterialCommunityIcons name="check-circle" size={90} color="#22c55e" />
        <Text style={styles.bigTitle}>All done!</Text>
        <Text style={styles.subText}>
          Your {SERVICE_LABELS[form.service_type] || 'service'} has been completed.
          We hope you're back on the road!
        </Text>
        {currentRequestId ? (
          <TouchableOpacity
            style={styles.orangeBtn}
            onPress={() => navigation.navigate('RidePayment', { rideId: currentRequestId })}
          >
            <Text style={styles.orangeBtnText}>Pay Now</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.cancelLink} onPress={resetForm}>
          <Text style={styles.cancelLinkText}>New Request</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Live tracking ───────────────────────────────────────────────────────────

  if (status === 'accepted' || status === 'in_progress') {
    const driver = acceptedRequest?.driver;
    return (
      <View style={{ flex: 1, backgroundColor: '#0F1B2C' }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          // @teovilla/react-native-web-maps (the web implementation
          // behind PlatformMap) needs its own API key passed as a prop
          // directly — separate from the native app.json config, which
          // only covers iOS/Android. Native react-native-maps silently
          // ignores unrecognized props, so this is safe there too.
          googleMapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as any}
          initialRegion={
            userLocation
              ? { ...userLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 }
              : undefined
          }
          showsUserLocation
        >
          {userLocation && (
            <Marker coordinate={userLocation} title="Your location">
              <MaterialCommunityIcons name="map-marker" size={32} color="#F97316" />
            </Marker>
          )}
          {driverLocation && (
            <Marker coordinate={driverLocation} title="Driver">
              <View style={styles.driverMarker}>
                <MaterialCommunityIcons name="truck" size={26} color="white" />
              </View>
            </Marker>
          )}
          {userLocation && driverLocation && (
            <Polyline
              coordinates={routeCoords.length > 1 ? routeCoords : [driverLocation, userLocation]}
              strokeColor="#F97316"
              strokeWidth={3}
              lineDashPattern={routeCoords.length > 1 ? undefined : [6, 4]}
            />
          )}
        </MapView>

        <View style={styles.driverCard}>
          {status === 'in_progress' ? (
            <View style={styles.statusBanner}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#22c55e" />
              <Text style={[styles.statusBannerText, { color: '#22c55e' }]}>Driver has arrived</Text>
            </View>
          ) : (
            <View style={styles.statusBanner}>
              <MaterialCommunityIcons name="clock-outline" size={18} color="#F97316" />
              <Text style={[styles.statusBannerText, { color: '#F97316' }]}>ETA: {eta}</Text>
            </View>
          )}

          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Feather name="user" size={28} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{driver?.driver_name ?? 'Provider'}</Text>
              <Text style={styles.driverVehicle}>{driver?.driver_vehicle ?? ''}</Text>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => showAlert('Call', `Calling ${driver?.driver_phone}`)}
            >
              <Feather name="phone" size={22} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.serviceChip}>
            <Text style={styles.serviceChipText}>
              {SERVICE_LABELS[form.service_type] || 'Service'}
            </Text>
          </View>

          <View style={styles.liveTrackingActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ClientDashboard')}
              style={styles.minimizeButton}
            >
              <Feather name="home" size={16} color="#9CA3AF" />
              <Text style={styles.minimizeButtonText}>Back to dashboard</Text>
            </TouchableOpacity>
            <Text style={styles.minimizeHint}>Your request keeps going even while you're not looking at this screen.</Text>

            <TouchableOpacity onPress={handleCancel} style={{ marginTop: 10 }}>
              <Text style={styles.cancelLinkText}>Cancel request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Searching ───────────────────────────────────────────────────────────────

  if (status === 'searching') {
    return (
      <View style={styles.centeredScreen}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MaterialCommunityIcons name="truck-fast" size={90} color="#F97316" />
        </Animated.View>
        <Text style={styles.bigTitle}>Finding a provider...</Text>
        <Text style={styles.subText}>
          We're matching you with the nearest available service provider.
        </Text>
        <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
          <Text style={styles.cancelLinkText}>Cancel request</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Booking form ────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBackButton}>
        <Text style={styles.topBackArrow}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <MaterialCommunityIcons name="truck-fast" size={52} color="#F97316" />
        <Text style={styles.title}>Roadside Assistance</Text>
        <Text style={styles.subtitle}>
          Stranded? Get reliable help sent to your location.
        </Text>
      </View>

      {userLocation && (
        <MapView
          provider={PROVIDER_GOOGLE}
          googleMapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as any}
          style={styles.map}
          initialRegion={{ ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          showsUserLocation
        >
          <Marker coordinate={userLocation} pinColor="#F97316" title="You are here" />
        </MapView>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Request Help</Text>

        <Text style={styles.label}>What service do you need?</Text>
        <TouchableOpacity
          style={styles.pickerWrap}
          onPress={() => setIsServicePickerVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={form.service_type ? styles.pickerValueText : styles.pickerPlaceholderText}>
            {SERVICE_OPTIONS.find((o) => o.value === form.service_type)?.label || 'Select a service...'}
          </Text>
          <Feather name="chevron-down" size={18} color="#F97316" />
        </TouchableOpacity>

        <SelectModal
          visible={isServicePickerVisible}
          title="What service do you need?"
          options={SERVICE_OPTIONS}
          selectedValue={form.service_type}
          onClose={() => setIsServicePickerVisible(false)}
          onSelect={(v) => {
            setForm((p) => ({ ...p, service_type: v }));
            if (!TOW_SERVICE_TYPES.includes(v)) {
              setTransmissionType('');
              setIsAccidentScene(false);
              setDestinationQuery('');
              setDestinationLocation(null);
              setDestinationPredictions([]);
              setTowEstimate(null);
              setEstimateError(null);
            }
          }}
        />

        <Text style={styles.label}>
          {form.for_someone_else ? "Beneficiary's location" : 'Your location'}
        </Text>
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="map-marker" size={20} color="#F97316" />
          <TextInput
            style={styles.input}
            placeholder="Search for a street address, suburb, city..."
            placeholderTextColor="#6B7280"
            value={form.address}
            onChangeText={handleAddressChange}
          />
          {isSearchingPlaces || isResolvingPlace ? (
            <ActivityIndicator size="small" color="#F97316" />
          ) : null}
        </View>

        {placePredictions.length > 0 && (
          <View style={styles.predictionsBox}>
            {placePredictions.map((prediction) => (
              <TouchableOpacity
                key={prediction.placeId}
                style={styles.predictionRow}
                onPress={() => handleSelectPrediction(prediction)}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={16} color="#9CA3AF" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.predictionMain} numberOfLines={1}>
                    {prediction.mainText ?? prediction.description}
                  </Text>
                  {prediction.secondaryText ? (
                    <Text style={styles.predictionSecondary} numberOfLines={1}>
                      {prediction.secondaryText}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedLocation && locationSource === 'gps' && !form.for_someone_else ? (
          <Text style={styles.locationHint}>Using your current location. Search above to change it.</Text>
        ) : null}
        {!selectedLocation && form.for_someone_else ? (
          <Text style={styles.locationHintWarning}>
            Search for where they actually are — your own location won't be used for this request.
          </Text>
        ) : null}

        {isTowRequest && (
          <>
            <Text style={styles.label}>Transmission</Text>
            <View style={styles.row3}>
              {(['manual', 'automatic'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.transmissionOption, transmissionType === t && styles.transmissionOptionSelected]}
                  onPress={() => setTransmissionType(t)}
                >
                  <Text
                    style={[
                      styles.transmissionOptionText,
                      transmissionType === t && styles.transmissionOptionTextSelected,
                    ]}
                  >
                    {t === 'manual' ? 'Manual' : 'Automatic'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.service_type === 'tow_sling' && transmissionType === 'automatic' ? (
              <Text style={styles.locationHintWarning}>
                A sling truck can't tow an automatic. Switch to Rollback above, or change the transmission.
              </Text>
            ) : null}

            <View style={styles.switchRow}>
              <Switch
                value={isAccidentScene}
                onValueChange={setIsAccidentScene}
                trackColor={{ true: '#F97316', false: '#374151' }}
                thumbColor="white"
              />
              <Text style={styles.switchLabel}>Towing from an accident scene?</Text>
            </View>

            <Text style={styles.label}>Tow to</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="flag-checkered" size={20} color="#F97316" />
              <TextInput
                style={styles.input}
                placeholder="Search for the delivery point..."
                placeholderTextColor="#6B7280"
                value={destinationQuery}
                onChangeText={handleDestinationChange}
              />
              {isSearchingDestination || isResolvingDestination ? (
                <ActivityIndicator size="small" color="#F97316" />
              ) : null}
            </View>

            {destinationPredictions.length > 0 && (
              <View style={styles.predictionsBox}>
                {destinationPredictions.map((prediction) => (
                  <TouchableOpacity
                    key={prediction.placeId}
                    style={styles.predictionRow}
                    onPress={() => handleSelectDestinationPrediction(prediction)}
                  >
                    <MaterialCommunityIcons name="map-marker-outline" size={16} color="#9CA3AF" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.predictionMain} numberOfLines={1}>
                        {prediction.mainText ?? prediction.description}
                      </Text>
                      {prediction.secondaryText ? (
                        <Text style={styles.predictionSecondary} numberOfLines={1}>
                          {prediction.secondaryText}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {isFetchingEstimate ? (
              <View style={styles.fareBox}>
                <ActivityIndicator size="small" color="#F97316" />
                <Text style={styles.fareBoxLabel}>Calculating fare...</Text>
              </View>
            ) : towEstimate ? (
              <View style={styles.fareBox}>
                <Text style={styles.fareAmount}>R{towEstimate.fare.toFixed(2)}</Text>
                <Text style={styles.fareBoxLabel}>
                  {towEstimate.distanceKm.toFixed(1)} km · {towEstimate.tier === 'local' ? 'Local rate' : 'Outside local rate'}
                </Text>
              </View>
            ) : estimateError ? (
              <Text style={styles.locationHintWarning}>{estimateError}</Text>
            ) : null}
          </>
        )}

        <Text style={styles.label}>Vehicle details</Text>
        <View style={styles.row3}>
          {(['make', 'model', 'license_plate'] as const).map((field, i) => (
            <TextInput
              key={field}
              style={[styles.vehicleInput, i === 2 && { marginRight: 0 }]}
              placeholder={field === 'license_plate' ? 'Plate' : field.charAt(0).toUpperCase() + field.slice(1)}
              placeholderTextColor="#6B7280"
              value={form[field]}
              onChangeText={(v) => setForm((p) => ({ ...p, [field]: v }))}
            />
          ))}
        </View>

        <Text style={styles.label}>Describe the issue</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="e.g. Battery dead, car won't start..."
          placeholderTextColor="#6B7280"
          multiline
          value={form.issue_description}
          onChangeText={(v) => setForm((p) => ({ ...p, issue_description: v }))}
        />

        <View style={styles.switchRow}>
          <Switch
            value={form.for_someone_else}
            onValueChange={(v) => setForm((p) => ({ ...p, for_someone_else: v }))}
            trackColor={{ true: '#F97316', false: '#374151' }}
            thumbColor="white"
          />
          <Text style={styles.switchLabel}>Requesting for someone else?</Text>
        </View>

        {form.for_someone_else && (
          <View style={styles.beneficiaryBox}>
            {[
              { icon: 'user', field: 'beneficiary_name', placeholder: 'Their name' },
              { icon: 'phone', field: 'beneficiary_phone', placeholder: 'Their phone number' },
            ].map(({ icon, field, placeholder }) => (
              <View key={field} style={[styles.inputRow, { marginBottom: 8 }]}>
                <Feather name={icon as any} size={18} color="#F97316" />
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  placeholderTextColor="#6B7280"
                  value={(form as any)[field]}
                  onChangeText={(v) => setForm((p) => ({ ...p, [field]: v }))}
                />
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (status === 'submitting' || (isTowRequest && !towEstimate)) && { opacity: 0.7 },
          ]}
          onPress={handleSubmit}
          disabled={status === 'submitting' || (isTowRequest && !towEstimate)}
          activeOpacity={0.85}
        >
          {status === 'submitting' ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialCommunityIcons name="truck-fast" size={20} color="white" />
              <Text style={styles.submitText}>
                {isTowRequest && towEstimate
                  ? `  Request — R${towEstimate.fare.toFixed(2)}`
                  : '  Request Help Now'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628', padding: 16 },
  header: { alignItems: 'center', paddingVertical: 24 },
  title: { fontSize: 26, fontWeight: 'bold', color: 'white', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  map: { width: '100%', height: 200, borderRadius: 14, marginBottom: 16 },
  card: {
    backgroundColor: '#142035',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: 'white', marginBottom: 4 },
  topBackButton: { paddingTop: 8, paddingBottom: 4 },
  topBackArrow: { color: '#9CA3AF', fontSize: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', marginTop: 16, marginBottom: 6 },
  pickerWrap: {
    backgroundColor: '#0A1628',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerValueText: { color: '#FFFFFF', fontSize: 14 },
  pickerPlaceholderText: { color: '#9CA3AF', fontSize: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    color: 'white',
    fontSize: 15,
  },
  textarea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  predictionsBox: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  predictionMain: { color: 'white', fontSize: 14, fontWeight: '600' },
  predictionSecondary: { color: '#9CA3AF', fontSize: 12, marginTop: 1 },
  locationHint: { color: '#6B7280', fontSize: 12, marginTop: 6 },
  locationHintWarning: { color: '#F97316', fontSize: 12, marginTop: 6 },
  row3: { flexDirection: 'row', gap: 8 },
  vehicleInput: {
    flex: 1,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 46,
    color: 'white',
    fontSize: 14,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  switchLabel: { color: '#D1D5DB', fontSize: 14 },
  transmissionOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#0A1628',
  },
  transmissionOptionSelected: { backgroundColor: '#F97316', borderColor: '#F97316' },
  transmissionOptionText: { color: '#D1D5DB', fontSize: 14, fontWeight: '600' },
  transmissionOptionTextSelected: { color: '#0A1628' },
  fareBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  fareAmount: { color: '#22C55E', fontSize: 22, fontWeight: '800' },
  fareBoxLabel: { color: '#9CA3AF', fontSize: 13 },
  beneficiaryBox: { backgroundColor: '#1E3A5F', borderRadius: 12, padding: 14, marginTop: 12 },
  submitBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: '#F97316',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  submitText: { color: 'white', fontSize: 16, fontWeight: '700' },
  centeredScreen: {
    flex: 1,
    backgroundColor: '#0A1628',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  bigTitle: { fontSize: 26, fontWeight: 'bold', color: 'white', marginTop: 20, textAlign: 'center' },
  subText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  orangeBtn: {
    backgroundColor: '#F97316',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 30,
  },
  orangeBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  cancelLink: { marginTop: 24 },
  cancelLinkText: { color: '#F97316', fontSize: 15, textDecorationLine: 'underline' },
  driverMarker: {
    backgroundColor: '#F97316',
    borderRadius: 50,
    padding: 8,
  },
  driverCard: {
    backgroundColor: '#142035',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 12,
  },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  statusBannerText: { fontWeight: '600', fontSize: 15 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: { color: 'white', fontWeight: '700', fontSize: 17 },
  driverVehicle: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  callBtn: {
    backgroundColor: '#22c55e',
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceChip: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  serviceChipText: { color: '#F97316', fontWeight: '600', fontSize: 13 },
  liveTrackingActions: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E3A5F',
  },
  minimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  minimizeButtonText: { color: '#D1D5DB', fontSize: 14, fontWeight: '600' },
  minimizeHint: { color: '#6B7280', fontSize: 12, marginTop: 4 },
});