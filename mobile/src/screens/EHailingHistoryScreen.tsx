// src/screens/EHailingHistoryScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { showAlert } from '../utils/crossPlatformAlert';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";
import { useAuth } from "../context/AuthContext";
import { getHistory, confirmCashReceived } from "../api/ehailingApi";
import { LIVE_RIDE_STATUSES } from "../constants/roadsideServices";

const SERVICE_LABELS: Record<string, string> = {
  towing: "Towing",
  jump_start: "Jump Start",
  tire_change: "Tire Change",
  fuel_delivery: "Fuel Delivery",
  lockout: "Lockout Service",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F97316",
  accepted: "#3B82F6",
  in_progress: "#8B5CF6",
  completed: "#22c55e",
  cancelled: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Driver Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

type HistoryItem = {
  id: string;
  serviceType: string;
  status: string;
  location: { address: string };
  vehicleDetails?: { make: string; model: string; licensePlate: string };
  fare?: number;
  createdAt: string;
  driver?: { driver_id?: string; driver_name: string };
  paymentMethod?: 'paystack' | 'cash';
  paymentStatus?: 'pending' | 'paid' | 'failed';
  driverCashConfirmed?: boolean;
  cashDisputedByDriver?: boolean;
};

export default function EHailingHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getHistory();
      setItems(res.data ?? []);
      setError(null);
    } catch {
      setError("Couldn't load your history — pull down to try again.");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handlePressItem = (item: HistoryItem) => {
    if (!LIVE_RIDE_STATUSES.includes(item.status)) return; // completed/cancelled — nothing live to show

    if (user?.role === "client") {
      navigation.navigate("EHailingClient", { resumeRideId: item.id });
    } else {
      // Driver-side resume isn't built yet — EHailingDriverScreen only
      // knows about a job once you've accepted it from the pending
      // list in the current session, there's no "reload my active job"
      // path yet the way there now is for clients. Saying so directly
      // rather than silently doing nothing.
      showAlert(
        "Active job",
        "Open \"View Job Requests\" from your dashboard to see your current active job — resuming it directly from history isn't available yet."
      );
    }
  };

  const handleCashConfirm = async (item: HistoryItem, received: boolean) => {
    setConfirmingId(item.id);
    try {
      const res = await confirmCashReceived(item.id, received);
      const updated = res?.data;
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                driverCashConfirmed: updated?.driverCashConfirmed ?? received,
                cashDisputedByDriver: updated?.cashDisputedByDriver ?? !received,
              }
            : it
        )
      );
    } catch {
      showAlert('Error', "Couldn't update this — please try again.");
    } finally {
      setConfirmingId(null);
    }
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const date = new Date(item.createdAt).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const statusColor = STATUS_COLORS[item.status] ?? "#9CA3AF";

    const isLive = LIVE_RIDE_STATUSES.includes(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePressItem(item)}
        disabled={!isLive}
        activeOpacity={isLive ? 0.7 : 1}
      >
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.serviceText}>
              {SERVICE_LABELS[item.serviceType] ?? "Service"}
            </Text>
            <Text style={styles.dateText}>{date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={15} color="#6B7280" />
          <Text style={styles.infoText} numberOfLines={1}>{item.location.address}</Text>
        </View>
        {item.vehicleDetails ? (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="car-outline" size={15} color="#6B7280" />
            <Text style={styles.infoText}>
              {[item.vehicleDetails.make, item.vehicleDetails.model, item.vehicleDetails.licensePlate]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        ) : null}
        {item.driver && (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="account-outline" size={15} color="#6B7280" />
            <Text style={styles.infoText}>Driver: {item.driver.driver_name}</Text>
          </View>
        )}
        {item.fare ? (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="cash" size={15} color="#6B7280" />
            <Text style={styles.infoText}>R{item.fare}</Text>
          </View>
        ) : null}

        {item.paymentMethod === 'cash' &&
          item.status === 'completed' &&
          user?.role !== 'client' &&
          item.driver?.driver_id === user?.id && (
            <View style={styles.cashConfirmBox}>
              {item.driverCashConfirmed ? (
                <View style={styles.cashRow}>
                  <MaterialCommunityIcons name="check-circle" size={15} color="#22c55e" />
                  <Text style={[styles.cashConfirmText, { color: '#22c55e' }]}>Cash receipt confirmed</Text>
                </View>
              ) : item.cashDisputedByDriver ? (
                <View style={styles.cashRow}>
                  <MaterialCommunityIcons name="alert-circle" size={15} color="#EF4444" />
                  <Text style={[styles.cashConfirmText, { color: '#EF4444' }]}>You flagged this as not received</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.cashConfirmText}>
                    Client says they paid you R{item.fare} in cash — did you receive it?
                  </Text>
                  <View style={styles.cashButtonsRow}>
                    <TouchableOpacity
                      style={styles.cashYesBtn}
                      disabled={confirmingId === item.id}
                      onPress={() => handleCashConfirm(item, true)}
                    >
                      {confirmingId === item.id ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.cashBtnText}>Yes, received</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cashNoBtn}
                      disabled={confirmingId === item.id}
                      onPress={() => handleCashConfirm(item, false)}
                    >
                      <Text style={[styles.cashBtnText, { color: '#EF4444' }]}>Didn't receive it</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

        {isLive && (
          <View style={styles.liveRow}>
            <MaterialCommunityIcons name="map-marker-radius" size={14} color="#F97316" />
            <Text style={styles.liveText}>Tap to see live progress</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request History</Text>
        <Text style={styles.headerSub}>{items.length} past requests</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#F97316" size="large" />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#374151" />
          <Text style={styles.emptyTitle}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="history" size={64} color="#374151" />
          <Text style={styles.emptyTitle}>No requests yet</Text>
          <Text style={styles.emptySubtext}>Your past roadside requests will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F97316" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A1628" },
  header: {
    backgroundColor: "#142035",
    padding: 20,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#1E3A5F",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "white" },
  headerSub: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  backButton: { marginBottom: 10 },
  backArrow: { color: "white", fontSize: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  emptyTitle: { color: "#6B7280", fontSize: 18, fontWeight: "600", textAlign: "center" },
  emptySubtext: { color: "#4B5563", fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: "#142035",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  serviceText: { color: "white", fontWeight: "700", fontSize: 16 },
  dateText: { color: "#6B7280", fontSize: 12, marginTop: 3 },
  statusBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  infoText: { color: "#9CA3AF", fontSize: 13, flex: 1 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  liveText: { color: "#F97316", fontSize: 12, fontWeight: "600" },
  cashConfirmBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#0A1628",
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },
  cashRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cashConfirmText: { color: "#D1D5DB", fontSize: 12.5, lineHeight: 17 },
  cashButtonsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  cashYesBtn: {
    flex: 1,
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  cashNoBtn: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  cashBtnText: { color: "white", fontSize: 12.5, fontWeight: "700" },
});
