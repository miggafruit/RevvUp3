import React, { useEffect, useState } from 'react';
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
import { getServiceById, createService, updateService } from '../api/serviceApi';
import { Spec } from '../types/marketplace';
import SpecsEditor from '../components/SpecsEditor';
import ImagePickerField from '../components/ImagePickerField';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceForm'>;

const AVAILABILITY_OPTIONS: Array<'Available' | 'Booked Out' | 'By Appointment'> = [
  'Available',
  'By Appointment',
  'Booked Out'
];

const ServiceFormScreen: React.FC<Props> = ({ navigation, route }) => {
  const serviceId = route.params?.serviceId;
  const isEditing = !!serviceId;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [durationEstimate, setDurationEstimate] = useState('');
  const [availability, setAvailability] = useState<'Available' | 'Booked Out' | 'By Appointment'>(
    'Available'
  );
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [images, setImages] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    getServiceById(serviceId)
      .then((service) => {
        setName(service.name);
        setPrice(String(service.price));
        setCategory(service.category);
        setDescription(service.description);
        setDurationEstimate(service.durationEstimate);
        setAvailability(service.availability);
        setSpecs(service.specs || []);
        setImages(service.images || []);
      })
      .catch((error) => {
        console.warn('Failed to load service for editing', error);
        showAlert('Error', 'Could not load this service for editing');
      })
      .finally(() => setIsLoading(false));
  }, [serviceId]);

  const validate = (): string | null => {
    if (!name.trim()) return 'Please enter a service name';
    if (!price.trim() || isNaN(Number(price)) || Number(price) < 0) return 'Please enter a valid price';
    if (!category.trim()) return 'Please enter a category';
    if (!description.trim()) return 'Please enter a description';
    if (!durationEstimate.trim()) return 'Please enter a duration estimate';
    const incompleteSpec = specs.some((s) => !s.key.trim() || !s.value.trim());
    if (incompleteSpec) return 'Please fill in or remove incomplete detail rows';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      showAlert('Missing Information', validationError);
      return;
    }

    const payload = {
      name: name.trim(),
      price: Number(price),
      category: category.trim(),
      description: description.trim(),
      durationEstimate: durationEstimate.trim(),
      availability,
      specs,
      images
    };

    setIsSubmitting(true);
    try {
      if (isEditing && serviceId) {
        await updateService(serviceId, payload);
      } else {
        await createService(payload);
      }
      navigation.goBack();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Something went wrong saving this service';
      showAlert('Save Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Service' : 'New Service'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Service Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Full Oil Change"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Price (R)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. 350"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Maintenance, Bodywork, Diagnostics"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what this service includes"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text style={styles.label}>Duration Estimate</Text>
          <TextInput
            style={styles.input}
            value={durationEstimate}
            onChangeText={setDurationEstimate}
            placeholder="e.g. 2-3 hours, 1 day"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Availability</Text>
          <View style={styles.pillRow}>
            {AVAILABILITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.pill, availability === option && styles.pillActive]}
                onPress={() => setAvailability(option)}
              >
                <Text style={[styles.pillText, availability === option && styles.pillTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Details</Text>
          <SpecsEditor specs={specs} onChange={setSpecs} />

          <Text style={styles.label}>Photos</Text>
          <ImagePickerField images={images} onChange={setImages} />

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>{isEditing ? 'Save Changes' : 'Post Service'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  backArrow: { color: colors.textPrimary, fontSize: 20 },
  headerTitle: { ...typography.cardTitle, fontSize: 17, color: colors.textPrimary },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary
  },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '600' },
  pillTextActive: { color: colors.white },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 }
});

export default ServiceFormScreen;
