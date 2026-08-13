import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { authColors as c } from '../theme/authColors';

const BrandDivider: React.FC<{ style?: object }> = ({ style }) => (
  <View style={[styles.row, style]}>
    <View style={[styles.line, { backgroundColor: c.red }]} />
    <Text style={styles.text}>REVVUP</Text>
    <View style={[styles.line, { backgroundColor: c.green }]} />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { width: 28, height: 2, borderRadius: 1 },
  text: { color: c.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 3 },
});

export default BrandDivider;
