import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/auth';
import { authColors as c } from '../theme/authColors';
import BrandDivider from '../components/BrandDivider';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigateToDashboard = (role: UserRole) => {
    if (role === 'client') navigation.reset({ index: 0, routes: [{ name: 'ClientDashboard' }] });
    else if (role === 'service_provider')
      navigation.reset({ index: 0, routes: [{ name: 'ServiceProviderDashboard' }] });
    else navigation.reset({ index: 0, routes: [{ name: 'ShopDashboard' }] });
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showAlert('Missing Information', 'Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login({ email: email.trim().toLowerCase(), password });
      navigateToDashboard(user.role);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Invalid email or password';
      showAlert('Login Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <BrandDivider style={{ marginBottom: 20 }} />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Log in to continue your journey</Text>
          </View>

          <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>

          <View style={styles.inputRow}>
            <View style={[styles.iconCircle, { backgroundColor: c.iconCircleNeutral }]}>
              <MaterialCommunityIcons name="at" size={16} color={c.green} />
            </View>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.iconCircle, { backgroundColor: c.iconCircleNeutral }]}>
              <View style={styles.passwordDot} />
            </View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={c.textMuted}
              secureTextEntry
            />
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-end' }}>
            <Text style={styles.forgot}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={c.white} />
            ) : (
              <>
                <Text style={styles.loginText}>Log In</Text>
                <View style={styles.arrowCircle}>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={c.red} />
                </View>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('RegisterRoleSelect')}>
              <Text style={styles.signUpLink}>Create one</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <View style={[styles.footerLine, { backgroundColor: c.red }]} />
            <Text style={styles.footerText}>YOUR CAR. YOUR JOURNEY. YOUR REVVUP.</Text>
            <View style={[styles.footerLine, { backgroundColor: c.green }]} />
          </View>
          <Text style={styles.poweredByText}>
            Powered by <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>IdeasAI</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 30, fontWeight: '800', color: c.white },
  subtitle: { fontSize: 14, color: c.textSecondary, marginTop: 6 },
  sectionLabel: { color: c.green, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  passwordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.red },
  input: { flex: 1, color: c.white, fontSize: 15, paddingVertical: 10 },
  forgot: { color: c.green, fontSize: 13, fontWeight: '600', marginBottom: 20 },
  loginBtn: {
    backgroundColor: c.red,
    borderRadius: 30,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loginText: { color: c.white, fontSize: 16, fontWeight: '700', marginRight: 10 },
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { color: c.textMuted, fontSize: 12, marginHorizontal: 12, letterSpacing: 1 },
  signUpRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 40 },
  signUpText: { color: c.textSecondary, fontSize: 14 },
  signUpLink: { color: c.green, fontWeight: '700', fontSize: 14 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 'auto' },
  footerLine: { width: 24, height: 1.5, borderRadius: 1 },
  footerText: { color: c.textMuted, fontSize: 10, letterSpacing: 1, fontWeight: '600' },
  poweredByText: { color: c.textMuted, fontSize: 9, marginTop: 6, opacity: 0.7, textAlign: 'center' },
});

export default LoginScreen;
