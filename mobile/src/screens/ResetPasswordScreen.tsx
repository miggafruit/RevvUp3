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
  Dimensions
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authColors } from '../theme/authColors';
import { resetPassword } from '../api/authApi';

const { height } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const [email, setEmail] = useState(route.params?.email || '');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!email.trim()) return 'Please enter your email address';
    if (!/^\d{6}$/.test(token.trim())) return 'Please enter the 6-digit code from your email';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      showAlert('Missing Information', validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        password
      });
      showAlert('Password Reset', 'Your password has been reset. Please log in.', [
        { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) }
      ]);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Could not reset your password. Please try again.';
      showAlert('Reset Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter the code we emailed you and choose a new password</Text>
          </View>

          <View style={styles.inputs}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={authColors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={token}
                onChangeText={(text) => setToken(text.replace(/[^0-9]/g, ''))}
                placeholder="6-digit code"
                placeholderTextColor={authColors.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="New password"
                placeholderTextColor={authColors.textSecondary}
                secureTextEntry
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={authColors.textSecondary}
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={authColors.white} />
              ) : (
                <Text style={styles.submitText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <View style={styles.backRow}>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.backLink}>Didn't get a code? Resend</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
    backgroundColor: authColors.background
  },
  header: {
    marginTop: height * 0.1,
    alignItems: 'center'
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: authColors.white,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 15,
    color: authColors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 21
  },
  inputs: {
    marginTop: 32
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 30,
    marginBottom: 16
  },
  input: {
    flex: 1,
    color: authColors.white,
    fontSize: 16
  },
  actions: {
    marginBottom: 60
  },
  submitBtn: {
    backgroundColor: authColors.red,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3
  },
  submitText: {
    color: authColors.white,
    fontSize: 18,
    fontWeight: '900'
  },
  backRow: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  backLink: {
    color: authColors.green,
    fontWeight: '700',
    fontSize: 14
  }
});

export default ResetPasswordScreen;