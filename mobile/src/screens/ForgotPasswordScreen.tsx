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
import { forgotPassword } from '../api/authApi';

const { height } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      showAlert('Missing Information', 'Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword({ email: trimmedEmail });
      showAlert(
        'Check Your Email',
        "If an account exists for that email, we've sent a reset code. It expires in 15 minutes.",
        [
          {
            text: 'Enter Code',
            onPress: () => navigation.navigate('ResetPassword', { email: trimmedEmail })
          }
        ]
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Something went wrong. Please try again.';
      showAlert('Request Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a code to reset your password
            </Text>
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
                <Text style={styles.submitText}>Send Reset Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('ResetPassword', undefined)}
              style={styles.altActionRow}
            >
              <Text style={styles.altActionText}>Already have a code? Enter it</Text>
            </TouchableOpacity>

            <View style={styles.backRow}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.backLink}>Back to Login</Text>
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
    marginTop: height * 0.15,
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
    marginTop: 40
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
  altActionRow: {
    alignItems: 'center',
    marginBottom: 24
  },
  altActionText: {
    color: authColors.green,
    fontWeight: '700',
    fontSize: 14
  },
  backRow: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  backLink: {
    color: authColors.textSecondary,
    fontSize: 14
  }
});

export default ForgotPasswordScreen;