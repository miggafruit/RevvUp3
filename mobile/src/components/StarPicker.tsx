import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface StarPickerProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}

const StarPicker: React.FC<StarPickerProps> = ({ value, onChange, size = 28 }) => (
  <View style={styles.row}>
    {[1, 2, 3, 4, 5].map((n) => (
      <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
        <Text style={{ fontSize: size, color: n <= value ? colors.star : colors.border, marginRight: 2 }}>★</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' }
});

export default StarPicker;
