import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import * as promotionApi from '../api/promotionApi';
import { PROMOTION_TIERS, PromotionTier } from '../api/promotionTiers';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePromotion'>;

const pickImage = async (): Promise<string | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showAlert('Permission Needed', 'Please allow photo library access to add a banner image.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.5,
    base64: true
  });

  if (result.canceled || !result.assets?.[0]?.base64) return null;

  const asset = result.assets[0];
  const mime = asset.mimeType || 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
};

const CreatePromotionScreen: React.FC<Props> = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [tier, setTier] = useState<PromotionTier>('7_days');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickImage = async () => {
    const uri = await pickImage();
    if (uri) setImage(uri);
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Please enter a title';
    if (!description.trim()) return 'Please enter a description';
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
      const promotion = await promotionApi.createPromotion({
        title: title.trim(),
        description: description.trim(),
        image: image || undefined,
        tier
      });
      navigation.replace('PromotionPayment', { promotionId: promotion._id });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Something went wrong creating your promotion';
      showAlert('Could Not Create Promotion', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Promotion</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 20% Off All Brake Pads"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell clients what the special is about"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text style={styles.label}>
            Banner Image <Text style={styles.optional}>(optional)</Text>
          </Text>
          {image ? (
            <View>
              <Image source={{ uri: image }} style={styles.previewImage} />
              <TouchableOpacity onPress={() => setImage(null)} style={{ marginTop: spacing.xs }}>
                <Text style={styles.removeImageText}>Remove image</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImage}>
              <Text style={styles.imagePickerButtonText}>+ Add Image</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Duration</Text>
          <View style={styles.tierRow}>
            {(Object.keys(PROMOTION_TIERS) as PromotionTier[]).map((key) => {
              const config = PROMOTION_TIERS[key];
              const isActive = tier === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.tierCard, isActive && styles.tierCardActive]}
                  onPress={() => setTier(key)}
                >
                  <Text style={[styles.tierLabel, isActive && styles.tierLabelActive]}>{config.label}</Text>
                  <Text style={[styles.tierPrice, isActive && styles.tierLabelActive]}>
                    R {config.price.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.disclaimer}>
            Your promotion goes live as soon as payment is confirmed on the next screen, and
            automatically stops showing once the duration ends.
          </Text>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>
                Continue to Payment · R {PROMOTION_TIERS[tier].price.toLocaleString()}
              </Text>
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
  optional: { fontWeight: '400', color: colors.textMuted },
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
  previewImage: { width: '100%', height: 140, borderRadius: radius.md },
  removeImageText: { color: colors.danger, fontSize: 12.5, fontWeight: '600' },
  imagePickerButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    alignItems: 'center'
  },
  imagePickerButtonText: { color: colors.accent, fontWeight: '600', fontSize: 13.5 },
  tierRow: { flexDirection: 'row', gap: spacing.sm },
  tierCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center'
  },
  tierCardActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tierLabel: { color: colors.textPrimary, fontWeight: '700', fontSize: 13, marginBottom: 2 },
  tierPrice: { color: colors.textSecondary, fontSize: 12 },
  tierLabelActive: { color: colors.white },
  disclaimer: { color: colors.textMuted, fontSize: 11.5, marginTop: spacing.lg, lineHeight: 17 },
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

export default CreatePromotionScreen;