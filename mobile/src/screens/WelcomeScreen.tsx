import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { authColors as c } from '../theme/authColors';
import BrandDivider from '../components/BrandDivider';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const FEATURES = [
  { icon: 'cog-outline', tint: c.iconCircleRedTint, iconColor: c.red, title: 'Parts', subtitle: 'Shop' },
  { icon: 'wrench-outline', tint: c.iconCircleGreenTint, iconColor: c.green, title: 'Services', subtitle: 'Book' },
  { icon: 'car-outline', tint: c.iconCircleRedTint, iconColor: c.red, title: 'Recovery', subtitle: 'Get Help' },
] as const;

const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.logoCard}>
          <Image source={require('../../assets/Logo.png')} style={styles.logoImage} resizeMode="contain" />
        </View>

        <BrandDivider style={{ marginTop: 14, marginBottom: 22 }} />

        <Text style={styles.welcomeTo}>Welcome to</Text>
        <Text style={styles.headline}>
          Everything your car{'\n'}
          <Text style={{ color: c.red }}>needs.</Text> <Text style={{ color: c.white }}>In one place.</Text>
        </Text>

        <Text style={styles.subtitle}>
          Find car parts, book automotive services, get roadside assistance and more.
        </Text>

        <View style={styles.featureRow}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <View style={[styles.featureIconCircle, { backgroundColor: f.tint }]}>
                <MaterialCommunityIcons name={f.icon as any} size={22} color={f.iconColor} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryButtonText}>Log In</Text>
          <View style={styles.arrowCircle}>
            <MaterialCommunityIcons name="chevron-right" size={18} color={c.red} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('RegisterRoleSelect')}
        >
          <Text style={styles.secondaryButtonText}>Create an Account</Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <View style={[styles.footerLine, { backgroundColor: c.red }]} />
          <Text style={styles.footerText}>YOUR CAR. YOUR JOURNEY. YOUR REVVUP.</Text>
          <View style={[styles.footerLine, { backgroundColor: c.green }]} />
        </View>
        <Text style={styles.poweredByText}>
          Powered by <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>IdeasAI</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.background },
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  logoCard: {
    backgroundColor: c.white,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
  },
  logoImage: { width: '100%', height: 90 },
  welcomeTo: { color: c.green, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  headline: { color: c.white, fontSize: 30, fontWeight: '800', textAlign: 'center', marginTop: 6, lineHeight: 36 },
  subtitle: {
    color: c.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 26,
    lineHeight: 20,
  },
  featureRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 28 },
  featureCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 18,
    alignItems: 'center',
  },
  featureIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: { color: c.white, fontSize: 14, fontWeight: '700' },
  featureSubtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  primaryButton: {
    width: '100%',
    backgroundColor: c.red,
    borderRadius: 30,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  primaryButtonText: { color: c.white, fontSize: 16, fontWeight: '700', marginRight: 10 },
  arrowCircle: {
    position: 'absolute',
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    width: '100%',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: c.green,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  secondaryButtonText: { color: c.green, fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 'auto', marginBottom: 20 },
  footerLine: { width: 24, height: 1.5, borderRadius: 1 },
  footerText: { color: c.textMuted, fontSize: 10, letterSpacing: 1, fontWeight: '600' },
  poweredByText: { color: c.textMuted, fontSize: 9, marginTop: 6, marginBottom: 8, opacity: 0.7 },
});

export default WelcomeScreen;
