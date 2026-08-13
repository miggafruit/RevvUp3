import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL, ACCESS_TOKEN_KEY } from '../api/client';
import { useAuth } from './AuthContext';

interface EHailingSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const EHailingSocketContext = createContext<EHailingSocketContextValue>({
  socket: null,
  isConnected: false,
});

/**
 * Establishes exactly ONE socket connection for the whole authenticated
 * session, at the app root — not one per screen. The previous
 * useEHailingSocket hook opened (and fully tore down) a brand-new
 * connection every time any component using it mounted/unmounted,
 * which meant a driver only ever received "new_request" while they
 * happened to have EHailingDriverScreen specifically open — nothing
 * was listening the rest of the time, since there was no persistent
 * connection anywhere else. It also meant that naively adding a second
 * listener screen would have opened a *second* simultaneous connection,
 * double-firing every event. This provider fixes both: one real
 * connection, alive for as long as the user is logged in, regardless
 * of which screen they're looking at.
 */
export const EHailingSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      return;
    }

    (async () => {
      const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token || cancelled) return;

      const s = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: { token },
      });

      s.on('connect', () => {
        console.log('[socket] connected:', s.id);
        setIsConnected(true);
      });
      s.on('disconnect', (reason) => {
        console.log('[socket] disconnected:', reason);
        setIsConnected(false);
      });
      s.on('connect_error', (err) => {
        console.warn('[socket] connect_error:', err.message);
      });

      socketRef.current = s;
      setSocket(s);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Tear down on unmount (app close) — not tied to any individual
  // screen's lifecycle.
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <EHailingSocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </EHailingSocketContext.Provider>
  );
};

export const useEHailingSocketConnection = () => useContext(EHailingSocketContext);

/**
 * Subscribes to specific events on the shared connection for as long as
 * the calling component is mounted. Unlike the old per-screen hook,
 * this does NOT create or destroy the connection itself — it just
 * attaches/detaches listeners on whatever connection the provider
 * already has open, so multiple screens can safely listen at once
 * without opening duplicate connections or double-firing events.
 */
export const useEHailingEvents = (events: {
  onNewRequest?: (request: any) => void;
  onRequestAccepted?: (request: any) => void;
  onDriverLocationUpdate?: (data: { request_id: string; latitude: number; longitude: number }) => void;
  onDriverArrived?: (data: { request_id: string }) => void;
  onRequestCompleted?: (data: { request_id: string; fare?: number }) => void;
  onRequestCancelled?: (data: { request_id: string }) => void;
  onAssignedRequestCancelled?: (data: { request_id: string }) => void;
  onRequestTaken?: (data: { request_id: string }) => void;
  onNewDelivery?: (delivery: any) => void;
  onDeliveryAccepted?: (delivery: any) => void;
  onDeliveryLocationUpdate?: (data: { delivery_id: string; latitude: number; longitude: number }) => void;
  onDeliveryPickedUp?: (data: { delivery_id: string }) => void;
  onDeliveryCompleted?: (data: { delivery_id: string }) => void;
  onDeliveryTaken?: (data: { delivery_id: string }) => void;
}) => {
  const { socket } = useEHailingSocketConnection();

  useEffect(() => {
    if (!socket) return;

    const pairs: [string, ((...args: any[]) => void) | undefined][] = [
      ['new_request', events.onNewRequest],
      ['request_accepted', events.onRequestAccepted],
      ['driver_location_update', events.onDriverLocationUpdate],
      ['driver_arrived', events.onDriverArrived],
      ['request_completed', events.onRequestCompleted],
      ['request_cancelled', events.onRequestCancelled],
      ['assigned_request_cancelled', events.onAssignedRequestCancelled],
      ['request_taken', events.onRequestTaken],
      ['new_delivery', events.onNewDelivery],
      ['delivery_accepted', events.onDeliveryAccepted],
      ['delivery_location_update', events.onDeliveryLocationUpdate],
      ['delivery_picked_up', events.onDeliveryPickedUp],
      ['delivery_completed', events.onDeliveryCompleted],
      ['delivery_taken', events.onDeliveryTaken],
    ];

    pairs.forEach(([event, handler]) => {
      if (handler) socket.on(event, handler);
    });

    return () => {
      pairs.forEach(([event, handler]) => {
        if (handler) socket.off(event, handler);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const emitDriverLocation = useCallback(
    (request_id: string, client_id: string, latitude: number, longitude: number) => {
      socket?.emit('driver_location', { request_id, client_id, latitude, longitude });
    },
    [socket]
  );

  const emitDeliveryLocation = useCallback(
    (delivery_id: string, client_id: string, latitude: number, longitude: number) => {
      socket?.emit('delivery_location', { delivery_id, client_id, latitude, longitude });
    },
    [socket]
  );

  return { socket, emitDriverLocation, emitDeliveryLocation };
};
