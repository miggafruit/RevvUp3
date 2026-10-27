import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Shown on shop / provider dashboards until a Google-verified business
// address is saved (account approval depends on it).
export default function AddressBanner({ onPress }: { onPress: () => void }) {
  const { user } = useAuth();
  if (!user || user.addressVerified) return null;
  return (
    <TouchableOpacity style={styles.box} onPress={onPress}>
      <Text style={styles.title}>📍 Confirm your business address</Text>
      <Text style={styles.sub}>Required before your account can be approved. Tap to pick it from the suggestions.</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2, borderRadius: 14, padding: 14, marginBottom: 16 },
  title: { color: '#92400E', fontWeight: '800', fontSize: 15 },
  sub: { color: '#92400E', fontSize: 12, marginTop: 4 }
});
