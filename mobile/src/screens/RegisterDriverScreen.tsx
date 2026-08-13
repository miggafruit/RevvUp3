import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import WaiverModal from '../components/WaiverModal';
import KycUploader from '../components/KycUploader';
import { RegisterPayload, KycDocument } from '../types/auth';
import { ROADSIDE_SERVICE_OPTIONS } from '../constants/roadsideServices';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RegisterDriver'>;

const RegisterDriverScreen: React.FC<Props> = ({ navigation }) => {
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [operatingArea, setOperatingArea] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [roadsideServices, setRoadsideServices] = useState<string[]>([]);
  const [kycDocuments, setKycDocuments] = useState<KycDocument[]>([]);

  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [waiverModalVisible, setWaiverModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!name.trim()) return 'Please enter your name';
    if (!email.trim()) return 'Please enter your email';
    if (!phone.trim()) return 'Please enter your phone number';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    if (!operatingArea.trim()) return 'Please enter the area you operate in';
    if (!vehicleMake.trim() || !vehicleModel.trim()) return 'Please enter your vehicle make and model';
    if (!licensePlate.trim()) return 'Please enter your license plate';
    if (!waiverAccepted) return 'You must accept the waiver to continue';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      showAlert('Missing Information', validationError);
      return;
    }

    const payload: RegisterPayload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      role: 'service_provider',
      // Drivers don't run a named "business" the way a mechanic shop does —
      // auto-filling this keeps the existing service_provider validation
      // (which requires businessName/businessAddress) satisfied without
      // showing the driver a confusing "Business Name" field.
      businessName: `${name.trim()} (Driver)`,
      businessAddress: operatingArea.trim(),
      category: 'Roadside & Delivery',
      isDriver: true,
      roadsideServices,
      vehicleDetails: {
        make: vehicleMake.trim(),
        model: vehicleModel.trim(),
        licensePlate: licensePlate.trim().toUpperCase()
      },
      waiverAccepted: true,
      ...(kycDocuments.length > 0 ? { kycDocuments } : {})
    };

    setIsSubmitting(true);
    try {
      await register(payload);
      navigation.reset({ index: 0, routes: [{ name: 'ServiceProviderDashboard' }] });
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Something went wrong while creating your account';
      showAlert('Registration Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Register as a Driver</Text>
          <Text style={styles.subtitle}>
            Deliver parts from shops to clients and respond to roadside assistance requests
          </Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="John Doe"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="john@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+27 71 234 5678"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Area You Operate In</Text>
          <TextInput placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={operatingArea}
            onChangeText={setOperatingArea}
            placeholder="e.g. Johannesburg CBD, Sandton"
          />

          <Text style={styles.sectionHeading}>Vehicle Details</Text>

          <Text style={styles.label}>Make</Text>
          <TextInput placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={vehicleMake}
            onChangeText={setVehicleMake}
            placeholder="e.g. Toyota"
          />

          <Text style={styles.label}>Model</Text>
          <TextInput placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={vehicleModel}
            onChangeText={setVehicleModel}
            placeholder="e.g. Corolla"
          />

          <Text style={styles.label}>License Plate</Text>
          <TextInput placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={licensePlate}
            onChangeText={setLicensePlate}
            placeholder="e.g. GP 12 ABC"
            autoCapitalize="characters"
          />

          <Text style={styles.sectionHeading}>Roadside Assistance (optional)</Text>
          <Text style={styles.kycNote}>
            Every driver here delivers shop orders. Additionally offer roadside
            help — towing, jump-starts, and the like — by selecting what you
            can actually do. Leave nothing selected if you only want to deliver.
          </Text>
          <View style={styles.serviceChipRow}>
            {ROADSIDE_SERVICE_OPTIONS.map((opt) => {
              const selected = roadsideServices.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.serviceChip, selected && styles.serviceChipSelected]}
                  onPress={() =>
                    setRoadsideServices((prev) =>
                      selected ? prev.filter((s) => s !== opt.value) : [...prev, opt.value]
                    )
                  }
                >
                  <Text style={[styles.serviceChipText, selected && styles.serviceChipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Password</Text>
          <TextInput placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            secureTextEntry
          />

          <Text style={[styles.label, { marginTop: 24 }]}>
            Identity & Vehicle Verification <Text style={styles.optional}>(optional)</Text>
          </Text>
          <Text style={styles.kycNote}>
            Uploading your driver's license and ID helps us verify you faster so you can start
            accepting delivery and roadside jobs sooner.
          </Text>
          <KycUploader role="service_provider" documents={kycDocuments} onChange={setKycDocuments} />

          <TouchableOpacity style={styles.waiverRow} onPress={() => setWaiverModalVisible(true)}>
            <View style={[styles.checkbox, waiverAccepted && styles.checkboxChecked]}>
              {waiverAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.waiverText}>
              I have read and accept the <Text style={styles.waiverLink}>waiver and terms</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Create Driver Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>Already have an account? Log In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <WaiverModal
        visible={waiverModalVisible}
        onClose={() => setWaiverModalVisible(false)}
        onAccept={() => {
          setWaiverAccepted(true);
          setWaiverModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6
  },
  subtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 19
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 24,
    marginBottom: 4
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 14
  },
  optional: {
    fontWeight: '400',
    color: colors.textMuted
  },
  kycNote: {
    fontSize: 12.5,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 18
  },
  serviceChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  serviceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface
  },
  serviceChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  serviceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  serviceChipTextSelected: {
    color: colors.white
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary
  },
  waiverRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 24,
    gap: 10
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  checkmark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700'
  },
  waiverText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  },
  waiverLink: {
    color: colors.accent,
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  submitButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700'
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center'
  },
  loginLinkText: {
    color: colors.accent,
    fontWeight: '600'
  }
});

export default RegisterDriverScreen;