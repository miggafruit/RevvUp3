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
  Platform,
  Switch
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import WaiverModal from '../components/WaiverModal';
import KycUploader from '../components/KycUploader';
import { RegisterPayload, UserRole, KycDocument } from '../types/auth';
import { ROADSIDE_SERVICE_OPTIONS } from '../constants/roadsideServices';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const ROLE_LABELS: Record<UserRole, string> = {
  client: 'Client',
  service_provider: 'Service Provider',
  shop: 'Shop'
};

const RegisterScreen: React.FC<Props> = ({ route, navigation }) => {
  const { role } = route.params;
  const { register } = useAuth();
  const isBusiness = role === 'service_provider' || role === 'shop';
  // Shops don't drive or tow — this opt-in only makes sense for
  // service_provider accounts (mechanics, panel beaters, etc. who may
  // also own a tow truck or want to do deliveries on the side).
  const canOfferDispatchWork = role === 'service_provider';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [category, setCategory] = useState('');
  const [kycDocuments, setKycDocuments] = useState<KycDocument[]>([]);

  // Optional — a service_provider isn't required to also deliver or do
  // roadside work, this is purely additive to whatever their main
  // listed service is.
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [roadsideServices, setRoadsideServices] = useState<string[]>([]);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const offersDispatchWork = offersDelivery || roadsideServices.length > 0;

  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [waiverModalVisible, setWaiverModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigateToDashboard = (userRole: UserRole) => {
    if (userRole === 'client') navigation.reset({ index: 0, routes: [{ name: 'ClientDashboard' }] });
    else if (userRole === 'service_provider')
      navigation.reset({ index: 0, routes: [{ name: 'ServiceProviderDashboard' }] });
    else navigation.reset({ index: 0, routes: [{ name: 'ShopDashboard' }] });
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Please enter your name';
    if (!email.trim()) return 'Please enter your email';
    if (!phone.trim()) return 'Please enter your phone number';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    if (isBusiness && !businessName.trim()) return 'Please enter your business name';
    if (isBusiness && !businessAddress.trim()) return 'Please enter your business address';
    if (canOfferDispatchWork && offersDispatchWork) {
      if (!vehicleMake.trim() || !vehicleModel.trim() || !licensePlate.trim()) {
        return "Please add your vehicle's make, model, and license plate — clients need to know what to look for.";
      }
    }
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
      role,
      waiverAccepted: true,
      ...(isBusiness
        ? {
            businessName: businessName.trim(),
            businessAddress: businessAddress.trim(),
            category: category.trim() || undefined
          }
        : {}),
      ...(canOfferDispatchWork
        ? {
            isDriver: offersDelivery,
            roadsideServices,
            ...(offersDispatchWork
              ? {
                  vehicleDetails: {
                    make: vehicleMake.trim(),
                    model: vehicleModel.trim(),
                    licensePlate: licensePlate.trim().toUpperCase()
                  }
                }
              : {})
          }
        : {}),
      ...(isBusiness && kycDocuments.length > 0 ? { kycDocuments } : {})
    };

    setIsSubmitting(true);
    try {
      const user = await register(payload);
      navigateToDashboard(user.role);
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Register as {ROLE_LABELS[role]}</Text>

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

          {isBusiness && (
            <>
              <Text style={styles.label}>Business Name</Text>
              <TextInput placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder={role === 'shop' ? 'e.g. AutoParts Pro' : 'e.g. Mike\'s Mechanics'}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Business Address</Text>
              <TextInput placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={businessAddress}
                onChangeText={setBusinessAddress}
                placeholder="123 Main Street, City"
              />

              <Text style={styles.label}>
                Category <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder={
                  role === 'shop'
                    ? 'e.g. Spares, Tyres'
                    : 'e.g. Mechanic, Panel & Paint, Roadside/Driver'
                }
              />

              {canOfferDispatchWork && (
                <>
                  <Text style={[styles.label, { marginTop: 24 }]}>
                    Delivery & Roadside Assistance <Text style={styles.optional}>(optional)</Text>
                  </Text>
                  <Text style={styles.kycNote}>
                    Also deliver shop orders or respond to roadside assistance requests, on top of
                    whatever you're listed for above. Skip this if you just want to be found for
                    your main service.
                  </Text>

                  <View style={styles.switchRow}>
                    <Switch
                      value={offersDelivery}
                      onValueChange={setOffersDelivery}
                      trackColor={{ true: colors.accent, false: colors.border }}
                      thumbColor="#ffffff"
                    />
                    <Text style={styles.switchLabel}>Deliver parts from shops to clients</Text>
                  </View>

                  <Text style={[styles.label, { marginTop: 16 }]}>Roadside services you offer</Text>
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

                  {offersDispatchWork && (
                    <>
                      <Text style={[styles.label, { marginTop: 16 }]}>
                        Vehicle details <Text style={styles.optional}>(required for delivery/roadside)</Text>
                      </Text>
                      <TextInput placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        value={vehicleMake}
                        onChangeText={setVehicleMake}
                        placeholder="Make (e.g. Toyota)"
                      />
                      <TextInput placeholderTextColor={colors.textMuted}
                        style={[styles.input, { marginTop: 10 }]}
                        value={vehicleModel}
                        onChangeText={setVehicleModel}
                        placeholder="Model (e.g. Hilux)"
                      />
                      <TextInput placeholderTextColor={colors.textMuted}
                        style={[styles.input, { marginTop: 10 }]}
                        value={licensePlate}
                        onChangeText={setLicensePlate}
                        placeholder="License plate"
                        autoCapitalize="characters"
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}

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

          {isBusiness && (
            <>
              <Text style={[styles.label, { marginTop: 24 }]}>
                Identity Verification <Text style={styles.optional}>(optional)</Text>
              </Text>
              <Text style={styles.kycNote}>
                {role === 'shop'
                  ? 'Verifying your shop helps build trust with clients browsing your products.'
                  : 'Verifying your account helps build trust with clients — including for roadside assistance and delivery jobs.'}
              </Text>
              <KycUploader
                role={role as 'shop' | 'service_provider'}
                documents={kycDocuments}
                onChange={setKycDocuments}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.waiverRow}
            onPress={() => setWaiverModalVisible(true)}
          >
            <View style={[styles.checkbox, waiverAccepted && styles.checkboxChecked]}>
              {waiverAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.waiverText}>
              I have read and accept the{' '}
              <Text style={styles.waiverLink}>waiver and terms</Text>
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
              <Text style={styles.submitButtonText}>Create Account</Text>
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
    marginBottom: 24
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10
  },
  switchLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flexShrink: 1
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

export default RegisterScreen;