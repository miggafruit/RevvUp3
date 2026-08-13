import apiClient from './client';

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText?: string;
  secondaryText?: string;
}

export interface PlaceDetails {
  address: string;
  latitude: number;
  longitude: number;
}

export const searchPlaces = (query: string, near?: { latitude: number; longitude: number }) =>
  apiClient
    .get<{ success: boolean; data: PlacePrediction[] }>('/location/search', {
      params: { query, latitude: near?.latitude, longitude: near?.longitude },
    })
    .then((r) => r.data.data);

export const getPlaceDetails = (placeId: string) =>
  apiClient
    .get<{ success: boolean; data: PlaceDetails }>(`/location/place/${placeId}`)
    .then((r) => r.data.data);

export const reverseGeocode = (latitude: number, longitude: number) =>
  apiClient
    .get<{ success: boolean; data: { address: string } }>('/location/reverse-geocode', {
      params: { latitude, longitude },
    })
    .then((r) => r.data.data.address);

export const geocodeAddress = (address: string) =>
  apiClient
    .get<{ success: boolean; data: { latitude: number; longitude: number; formattedAddress: string } }>(
      '/location/geocode',
      { params: { address } }
    )
    .then((r) => r.data.data);

export interface DirectionsResult {
  encodedPolyline: string;
  distanceMeters?: number;
  durationSeconds?: number;
}

export const getDirections = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
) =>
  apiClient
    .get<{ success: boolean; data: DirectionsResult }>('/location/directions', {
      params: {
        originLat: origin.latitude,
        originLng: origin.longitude,
        destLat: destination.latitude,
        destLng: destination.longitude,
      },
    })
    .then((r) => r.data.data);
