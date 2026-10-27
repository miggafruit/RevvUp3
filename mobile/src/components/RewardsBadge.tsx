import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

// The "participating in RevvUp Rewards" marker shown on profiles, listing cards
// and product/service pages. Deliberately loud (gold, star) so clients can
// spot sellers where their points earn and spend.
export default function RewardsBadge({ size = 'small' }: { size?: 'small' | 'large' }) {
  const large = size === 'large';
  return (
    <View style={[styles.badge, large && styles.large]}>
      <Text style={[styles.text, large && styles.textLarge]}>⭐ REWARDS</Text>
      {large && <Text style={styles.sub}>Earn 2% back in points · accepts points</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FACC15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  large: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  text: { color: '#111827', fontWeight: '900', fontSize: 11, letterSpacing: 0.6 },
  textLarge: { fontSize: 15 },
  sub: { color: '#374151', fontSize: 11, fontWeight: '600', marginTop: 2 }
});
