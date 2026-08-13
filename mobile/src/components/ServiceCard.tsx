import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { colors, spacing, radius, typography } from '../theme/colors';
import { Service } from '../types/marketplace';

interface ServiceCardProps {
  service: Service;
  onPress: () => void;
  onAddToCart: () => void;
  isAddingToCart?: boolean;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onPress, onAddToCart, isAddingToCart }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageWrapper}>
        {service.thumbnail ? (
          <Image source={{ uri: service.thumbnail }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>No image</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {service.name}
        </Text>
        <Text style={styles.price}>R {service.price.toLocaleString()}</Text>
        <Text style={styles.duration} numberOfLines={1}>
          {service.durationEstimate}
        </Text>

        <TouchableOpacity
          style={[styles.addButton, isAddingToCart && styles.addButtonDisabled]}
          onPress={(e) => {
            e.stopPropagation();
            onAddToCart();
          }}
          disabled={isAddingToCart}
        >
          <Text style={styles.addButtonText}>{isAddingToCart ? 'Adding…' : '+ Book Service'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border
  },
  imageWrapper: {
    width: '100%',
    height: 110
  },
  image: {
    width: '100%',
    height: '100%'
  },
  imagePlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  imagePlaceholderText: {
    color: colors.textMuted,
    fontSize: 12
  },
  body: {
    padding: spacing.md
  },
  name: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    marginBottom: 4
  },
  price: {
    ...typography.price,
    color: colors.accent,
    marginBottom: 2
  },
  duration: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginBottom: spacing.sm
  },
  addButton: {
    backgroundColor: colors.accent,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center'
  },
  addButtonDisabled: {
    opacity: 0.6
  },
  addButtonText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: '700'
  }
});

export default ServiceCard;
