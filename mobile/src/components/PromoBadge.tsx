import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

// Marks a seller that is currently running a paid promotion ("special").
// Orange tag, deliberately different from the purple 🎁 REWARDS badge and the
// gold ★ rating stars, so the three never get confused.
export default function PromoBadge({ floating = false }: { floating?: boolean }) {
  return (
    <View style={[styles.badge, floating && styles.floating]}>
      <Text style={styles.text}>🏷️ SPECIAL</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', backgroundColor: '#EA580C', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  floating: { position: 'absolute', top: 8, left: 8 },
  text: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, letterSpacing: 0.6 }
});
