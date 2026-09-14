import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  /** Optional address/status text to still show even without a map. */
  subtitle?: string;
}

/**
 * Shown instead of a native MapView when no Google Maps API key is
 * configured (see utils/mapsConfig.ts). Without a real key, the native
 * map renders as a blank/dark rectangle with no indication of why —
 * this replaces that with an explanation and whatever text-based
 * location info is still available, instead of leaving the screen
 * looking broken.
 */
const MapUnavailableNotice: React.FC<Props> = ({ subtitle }) => {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="map-marker-off-outline" size={36} color="#6B7280" />
      <Text style={styles.title}>Map view isn't set up yet</Text>
      <Text style={styles.body}>A Google Maps API key hasn't been configured for this app.</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  title: { color: '#E5E7EB', fontSize: 15, fontWeight: '700', marginTop: 4 },
  body: { color: '#9CA3AF', fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  subtitle: { color: '#F97316', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});

export default MapUnavailableNotice;
