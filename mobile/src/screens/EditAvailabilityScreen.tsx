import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/authApi';
import { ROADSIDE_SERVICE_OPTIONS } from '../constants/roadsideServices';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditAvailability'>;

const EditAvailabilityScreen: React.FC<Props> = ({ navigation }) => {
  const { user, setUser } = useAuth();

  const [offersDelivery, setOffersDelivery] = useState(!!user?.isDriver);
  const [roadsideServices, setRoadsideServices] = useState<string[]>(user?.roadsideServices ?? []);
  const [vehicleMake, setVehicleMake] = useState(user?.vehicleDetails?.make ?? '');
  const [vehicleModel, setVehicleModel] = useState(user?.vehicleDetails?.model ?? '');
  const [licensePlate, setLicensePlate] = useState(user?.vehicleDetails?.licensePlate ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const offersDispatchWork = offersDelivery || roadsideServices.length > 0;

  const handleSave = async () => {
    if (offersDispatchWork && (!vehicleMake.trim() || !vehicleModel.trim() || !licensePlate.trim())) {
      showAlert(
        'Missing vehicle details',
        "Please add your vehicle's make, model, and license plate — clients need to know what to look for."
      );
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateProfile({
        isDriver: offersDelivery,
        roadsideServices,
        ...(offersDispatchWork
          ? { vehicleDetails: { make: vehicleMake.trim(), model: vehicleModel.trim(), licensePlate: licensePlate.trim().toUpperCase() } }
          : {}),
      });
      setUser(updated);
      showAlert('Saved', 'Your availability has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      showAlert('Error', "Couldn't save your changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery & Roadside Assistance</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kycNote}>
          Deliver shop orders or respond to roadside assistance requests, on top of whatever
          you're listed for otherwise. Turn this off anytime — nothing else about your account changes.
        </Text>

        <View style={styles.switchRow}>
          <Switch
            value={offersDelivery}
            onValueChange={setOffersDelivery}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
          />
          <Text style={styles.switchLabel}>Deliver parts from shops to clients</Text>
        </View>

        <Text style={[styles.label, { marginTop: 20 }]}>Roadside services you offer</Text>
        <View style={styles.serviceChipRow}>
          {ROADSIDE_SERVICE_OPTIONS.map((opt) => {
            const selected = roadsideServices.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.serviceChip, selected && styles.serviceChipSelected]}
                onPress={() =>
                  setRoadsideServices((prev) =>
                    selected ? prev.filter((s) => s !== opt.value) : [...prev, opt.value]
                  )
                }
              >
                <Text style={[styles.serviceChipText, selected && styles.serviceChipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {offersDispatchWork && (
          <>
            <Text style={[styles.label, { marginTop: 16 }]}>Vehicle details</Text>
            <TextInput
              style={styles.input}
              value={vehicleMake}
              onChangeText={setVehicleMake}
              placeholder="Make (e.g. Toyota)"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              value={vehicleModel}
              onChangeText={setVehicleModel}
              placeholder="Model (e.g. Hilux)"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              value={licensePlate}
              onChangeText={setLicensePlate}
              placeholder="License plate"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
          </>
        )}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>Save</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backArrow: { color: colors.textPrimary, fontSize: 20 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  kycNote: { fontSize: 12.5, color: colors.textMuted, marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
  serviceChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  serviceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  serviceChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  serviceChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  serviceChipTextSelected: { color: colors.white },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});

export default EditAvailabilityScreen;
