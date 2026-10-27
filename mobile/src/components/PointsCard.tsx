import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRewards } from '../context/RewardsContext';
import { colors } from '../theme/colors';

// The big points tally at the top of the client dashboard.
export default function PointsCard({ onPress }: { onPress: () => void }) {
  const { summary } = useRewards();
  const points = summary?.points ?? 0;
  const value = summary?.valueRand ?? 0;
  return (
    <TouchableOpacity activeOpacity={0.9} style={styles.card} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>⭐ YOUR REWARD POINTS</Text>
        <Text style={styles.points}>{points.toLocaleString()}</Text>
        <Text style={styles.value}>worth R{value.toFixed(2)} at participating providers</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FACC15',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  label: { color: '#92400E', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  points: { color: '#111827', fontSize: 48, fontWeight: '900', lineHeight: 54 },
  value: { color: '#374151', fontWeight: '600', fontSize: 13 },
  chevron: { color: '#111827', fontSize: 36, fontWeight: '300' }
});
