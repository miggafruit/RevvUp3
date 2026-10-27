import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/authApi';
import { PlaceDetails } from '../api/locationApi';
import AddressSearchInput from '../components/AddressSearchInput';
import { showAlert } from '../utils/crossPlatformAlert';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessAddress'>;

// Shown right after a shop / provider registers (and reachable any time from
// the dashboard banner). The address MUST be picked from Google's suggestions,
// so its coordinates are exact: delivery pricing, driver pick-ups and
// "bring the vehicle to the provider" all depend on it.
const BusinessAddressScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user, setUser } = useAuth();
  const firstTime = !!route.params?.firstTime;
  const [text, setText] = useState(user?.businessAddress ?? '');
  const [picked, setPicked] = useState<PlaceDetails | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const goOn = () => {
    if (firstTime) {
      navigation.reset({
        index: 0,
        routes: [{ name: user?.role === 'shop' ? 'ShopDashboard' : 'ServiceProviderDashboard' }]
      });
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!picked) {
      showAlert('Pick your address', 'Start typing your street address and choose it from the suggestions list.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateProfile({
        businessAddress: picked.address,
        businessCoords: { latitude: picked.latitude, longitude: picked.longitude }
      });
      setUser(updated);
      showAlert('Address saved', 'Your business address is confirmed.', [{ text: 'OK', onPress: goOn }]);
    } catch (e: any) {
      showAlert('Could not save', e?.response?.data?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const verified = !!user?.addressVerified && !picked;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{firstTime ? 'One last step: your address' : 'Business address'}</Text>
        <Text style={styles.subtitle}>
          {user?.role === 'shop'
            ? 'Drivers collect orders from this address, and your delivery prices are calculated from it.'
            : 'Clients are shown this address when they bring their vehicle to you.'}
          {' '}Your account can only be approved once it is confirmed.
        </Text>

        {verified && (
          <View style={styles.okBox}>
            <Text style={styles.okText}>✅ Confirmed: {user?.businessAddress}</Text>
          </View>
        )}

        <Text style={styles.label}>Street address</Text>
        <AddressSearchInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setPicked(null);
          }}
          onSelectPlace={(details) => {
            setText(details.address);
            setPicked(details);
          }}
          placeholder="Start typing, e.g. 12 Main Road, Soweto"
        />
        {!!text && !picked && (
          <Text style={styles.hint}>Choose your address from the suggestions to confirm it.</Text>
        )}
        {picked && <Text style={styles.picked}>✅ {picked.address}</Text>}

        <TouchableOpacity
          style={[styles.button, (!picked || isSaving) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={!picked || isSaving}
        >
          {isSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Confirm address</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skip} onPress={goOn}>
          <Text style={styles.skipText}>{firstTime ? 'Do this later' : 'Cancel'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: spacing.sm },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.lg, lineHeight: 20 },
  label: { color: colors.textPrimary, fontWeight: '700', marginBottom: 6 },
  hint: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
  picked: { color: colors.success, marginTop: 8, fontWeight: '600' },
  okBox: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.success, marginBottom: spacing.md },
  okText: { color: colors.success, fontWeight: '600' },
  button: { backgroundColor: colors.accent, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: spacing.lg },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  skip: { alignItems: 'center', marginTop: spacing.md, padding: 8 },
  skipText: { color: colors.textSecondary }
});

export default BusinessAddressScreen;
