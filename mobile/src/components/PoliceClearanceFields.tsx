import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export interface PoliceClearanceInput {
  issuedOn: string; // YYYY-MM-DD
  referenceNumber: string;
}

interface Props {
  value: PoliceClearanceInput;
  onChange: (v: PoliceClearanceInput) => void;
}

// Collected alongside the uploaded certificate image (KycUploader's
// "Police Clearance Certificate" slot). An admin reads the certificate and
// confirms it before the account can be approved.
export default function PoliceClearanceFields({ value, onChange }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Police clearance (criminal record check)</Text>
      <Text style={styles.note}>
        Required for all drivers and for service providers working as individuals. Upload your
        police clearance certificate above (must be less than 6 months old), then enter its details:
      </Text>
      <Text style={styles.label}>Date issued (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={value.issuedOn}
        onChangeText={(t) => onChange({ ...value, issuedOn: t })}
        placeholder="e.g. 2026-10-01"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Text style={styles.label}>Certificate / reference number</Text>
      <TextInput
        style={styles.input}
        value={value.referenceNumber}
        onChangeText={(t) => onChange({ ...value, referenceNumber: t })}
        placeholder="Reference number on the certificate"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
      />
    </View>
  );
}

export const isValidIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());

const styles = StyleSheet.create({
  box: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, marginBottom: 6 },
  note: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  label: { color: colors.textSecondary, fontSize: 12, marginBottom: 4, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: colors.background
  }
});
