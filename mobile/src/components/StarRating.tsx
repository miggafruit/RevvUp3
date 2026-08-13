import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: number;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, reviewCount, size = 12 }) => {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.row}>
      <Text style={{ color: colors.star, fontSize: size }}>★</Text>
      <Text style={[styles.ratingText, { fontSize: size }]}>{rating > 0 ? rating.toFixed(1) : 'New'}</Text>
      {reviewCount !== undefined && reviewCount > 0 && (
        <Text style={[styles.reviewCount, { fontSize: size - 1 }]}> · {reviewCount} reviews</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  ratingText: {
    color: colors.textSecondary,
    fontWeight: '600',
    marginLeft: 4
  },
  reviewCount: {
    color: colors.textMuted
  }
});

export default StarRating;
