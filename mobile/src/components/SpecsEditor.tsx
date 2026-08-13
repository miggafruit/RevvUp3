import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme/colors';
import { Spec } from '../types/marketplace';

interface SpecsEditorProps {
  specs: Spec[];
  onChange: (specs: Spec[]) => void;
}

const SpecsEditor: React.FC<SpecsEditorProps> = ({ specs, onChange }) => {
  const updateSpec = (index: number, field: 'key' | 'value', text: string) => {
    const updated = [...specs];
    updated[index] = { ...updated[index], [field]: text };
    onChange(updated);
  };

  const removeSpec = (index: number) => {
    onChange(specs.filter((_, i) => i !== index));
  };

  const addSpec = () => {
    onChange([...specs, { key: '', value: '' }]);
  };

  return (
    <View>
      {specs.map((spec, index) => (
        <View key={index} style={styles.row}>
          <TextInput
            style={[styles.input, styles.keyInput]}
            value={spec.key}
            onChangeText={(text) => updateSpec(index, 'key', text)}
            placeholder="e.g. Material"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[styles.input, styles.valueInput]}
            value={spec.value}
            onChangeText={(text) => updateSpec(index, 'value', text)}
            placeholder="e.g. Cast Iron"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity style={styles.removeButton} onPress={() => removeSpec(index)}>
            <Text style={styles.removeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addButton} onPress={addSpec}>
        <Text style={styles.addButtonText}>+ Add Specification</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary
  },
  keyInput: { flex: 1 },
  valueInput: { flex: 1.4 },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeButtonText: { color: colors.danger, fontWeight: '700' },
  addButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: spacing.xs
  },
  addButtonText: { color: colors.accent, fontWeight: '600', fontSize: 13 }
});

export default SpecsEditor;
