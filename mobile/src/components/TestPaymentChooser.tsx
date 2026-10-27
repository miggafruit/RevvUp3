import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// TEMPORARY tester-only screen. Only ever rendered when the server says this
// account is on the test-payment allowlist (see backend utils/testPayments.js).
// Remove ALLOW_TEST_PAYMENTS / TEST_PAYMENT_EMAILS on Render and it vanishes.
export default function TestPaymentChooser({
  amountLabel,
  onPayWithCard,
  onTestPay
}: {
  amountLabel: string;
  onPayWithCard: () => void;
  onTestPay: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Pay {amountLabel}</Text>
      <TouchableOpacity style={styles.cardButton} onPress={onPayWithCard}>
        <Text style={styles.cardText}>Pay with card (real charge)</Text>
      </TouchableOpacity>
      <View style={styles.testBox}>
        <Text style={styles.testLabel}>TESTER ONLY</Text>
        <TouchableOpacity style={styles.testButton} onPress={onTestPay}>
          <Text style={styles.testText}>Test payment — no money moves</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1B2C', justifyContent: 'center', padding: 24 },
  title: { color: 'white', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  cardButton: { backgroundColor: '#F97316', padding: 16, borderRadius: 12, alignItems: 'center' },
  cardText: { color: 'white', fontWeight: '700', fontSize: 16 },
  testBox: { marginTop: 28, borderWidth: 1, borderStyle: 'dashed', borderColor: '#FACC15', borderRadius: 12, padding: 14 },
  testLabel: { color: '#FACC15', fontSize: 11, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  testButton: { backgroundColor: '#FACC15', padding: 14, borderRadius: 10, alignItems: 'center' },
  testText: { color: '#111827', fontWeight: '700' }
});
