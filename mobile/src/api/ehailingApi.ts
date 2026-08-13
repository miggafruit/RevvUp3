// src/api/ehailingApi.ts
//
// Now routed through the app's existing authenticated apiClient (see
// ./client.ts) instead of a separate, unauthenticated axios instance
// pointed at a hardcoded IP. Every call below now requires a logged-in
// session — the backend rejects unauthenticated requests entirely.
import apiClient from "./client";

// ─── CLIENT ──────────────────────────────────────────────────────────────────

export const createRideRequest = (payload: {
  service_type: string;
  location: { address: string; latitude?: number; longitude?: number };
  destination?: { address: string; latitude?: number; longitude?: number };
  transmission_type?: 'manual' | 'automatic';
  is_accident_scene?: boolean;
  vehicle_details: { make: string; model: string; license_plate: string };
  issue_description?: string;
  for_someone_else?: boolean;
  beneficiary_name?: string;
  beneficiary_phone?: string;
}) => apiClient.post("/ehailing/request", payload).then((r) => r.data);

export const getRequest = (id: string) =>
  apiClient.get(`/ehailing/request/${id}`).then((r) => r.data);

export const cancelRequest = (id: string, reason?: string) =>
  apiClient.post(`/ehailing/request/${id}/cancel`, { reason }).then((r) => r.data);

export const getHistory = () =>
  apiClient.get("/ehailing/history").then((r) => r.data);

export interface TowEstimate {
  distanceKm: number;
  durationMinutes: number;
  tier: 'local' | 'outside';
  fare: number;
}

export const getTowEstimate = (params: {
  service_type: 'tow_sling' | 'tow_rollback';
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
  transmission_type: 'manual' | 'automatic';
}) =>
  apiClient
    .get<{ success: boolean; data: TowEstimate }>("/ehailing/estimate/tow", { params })
    .then((r) => r.data.data);

export const payRide = (id: string, paymentReference: string) =>
  apiClient.post(`/ehailing/request/${id}/pay`, { paymentReference }).then((r) => r.data);

export const payCash = (id: string) =>
  apiClient.post(`/ehailing/request/${id}/pay-cash`).then((r) => r.data);

// ─── DRIVER ──────────────────────────────────────────────────────────────────

export const getPendingRequests = () =>
  apiClient.get("/ehailing/requests/pending").then((r) => r.data);

export const acceptRequest = (
  id: string,
  driverDetails?: { driver_location?: { latitude: number; longitude: number } }
) => apiClient.post(`/ehailing/request/${id}/accept`, driverDetails ?? {}).then((r) => r.data);

export const updateDriverLocation = (
  id: string,
  location: { latitude: number; longitude: number }
) => apiClient.post(`/ehailing/request/${id}/location`, location).then((r) => r.data);

export const markArrived = (id: string) =>
  apiClient.post(`/ehailing/request/${id}/arrived`).then((r) => r.data);

export const completeRequest = (id: string) =>
  apiClient.post(`/ehailing/request/${id}/complete`).then((r) => r.data);
