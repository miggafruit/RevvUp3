import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/authApi';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditBusinessProfile'>;

const MAX_PORTFOLIO_IMAGES = 12;

const pickImage = async (): Promise<string | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showAlert('Permission Needed', 'Please allow photo library access to upload a photo.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.5,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType || 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
};

// This screen exists because there was previously no way at all to add
// a profile photo, describe qualifications/experience, or showcase
// portfolio work — testers flagged this directly ("editing my profile
// and adding pictures and videos and my qualifications doesn't seem to
// be possible"). Video is handled as a link (YouTube, etc.) rather than
// an uploaded file — storing video as base64 doesn't scale the way an
// image does.
const EditBusinessProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, setUser } = useAuth();
  const isShop = user?.role === 'shop';

  // Previously this screen used identical copy regardless of role —
  // "Qualifications & Experience" and "Portfolio Images" make sense
  // for a mechanic/service provider, but read oddly for a shop, which
  // wants to describe its business and show storefront/product photos
  // instead of "past work." The client-facing display screens
  // (ShopDetailScreen/ProviderDetailScreen) already made this
  // distinction — this brings the edit screen in line with what
  // clients actually see.
  const copy = isShop
    ? {
        title: 'Edit Shop Profile',
        photoLabel: 'Shop Photo',
        photoHint: 'Add a shop photo',
        aboutTitle: 'About This Shop',
        aboutHelper: 'What you sell, your specialties, years in business — whatever helps clients trust you.',
        aboutPlaceholder: "e.g. Supplying genuine and aftermarket parts since 2015, specializing in German and Japanese vehicles...",
        galleryTitle: 'Shop & Product Photos',
        galleryHelper: `Photos of your shop, storefront, or featured products — up to ${MAX_PORTFOLIO_IMAGES}.`,
      }
    : {
        title: 'Edit Profile',
        photoLabel: 'Profile Photo',
        photoHint: 'Add a photo',
        aboutTitle: 'Qualifications & Experience',
        aboutHelper: 'Certifications, years of experience, specialties — whatever helps clients trust you.',
        aboutPlaceholder: 'e.g. 10 years as a certified mechanic, specializing in German vehicles...',
        galleryTitle: 'Portfolio Images',
        galleryHelper: `Photos of past work — up to ${MAX_PORTFOLIO_IMAGES}.`,
      };

  const [profilePhoto, setProfilePhoto] = useState<string | undefined>(user?.profilePhoto);
  const [qualifications, setQualifications] = useState(user?.qualifications || '');
  const [portfolioImages, setPortfolioImages] = useState<string[]>(user?.portfolioImages || []);
  const [profileVideoUrl, setProfileVideoUrl] = useState(user?.profileVideoUrl || '');
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [isAddingPortfolio, setIsAddingPortfolio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickProfilePhoto = async () => {
    setIsPickingPhoto(true);
    try {
      const image = await pickImage();
      if (image) setProfilePhoto(image);
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const handleAddPortfolioImage = async () => {
    if (portfolioImages.length >= MAX_PORTFOLIO_IMAGES) {
      showAlert('Limit Reached', `You can add up to ${MAX_PORTFOLIO_IMAGES} portfolio images.`);
      return;
    }
    setIsAddingPortfolio(true);
    try {
      const image = await pickImage();
      if (image) setPortfolioImages((prev) => [...prev, image]);
    } finally {
      setIsAddingPortfolio(false);
    }
  };

  const handleRemovePortfolioImage = (index: number) => {
    setPortfolioImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateProfile({
        profilePhoto,
        qualifications: qualifications.trim(),
        portfolioImages,
        profileVideoUrl: profileVideoUrl.trim(),
      });
      setUser(updated);
      showAlert('Saved', 'Your profile has been updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.message || "Couldn't save your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{copy.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>{copy.photoLabel}</Text>
        <TouchableOpacity style={styles.photoPicker} onPress={handlePickProfilePhoto} disabled={isPickingPhoto}>
          {isPickingPhoto ? (
            <ActivityIndicator color={colors.accent} />
          ) : profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.photoPreview} />
          ) : (
            <>
              <MaterialCommunityIcons name="camera-plus-outline" size={28} color={colors.accent} />
              <Text style={styles.photoPickerText}>{copy.photoHint}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>{copy.aboutTitle}</Text>
        <Text style={styles.helperText}>{copy.aboutHelper}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={qualifications}
          onChangeText={setQualifications}
          placeholder={copy.aboutPlaceholder}
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={5}
          maxLength={2000}
        />

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Video (optional)</Text>
        <Text style={styles.helperText}>Link to a video of your work — YouTube, etc.</Text>
        <TextInput
          style={styles.input}
          value={profileVideoUrl}
          onChangeText={setProfileVideoUrl}
          placeholder="https://youtube.com/..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>{copy.galleryTitle}</Text>
        <Text style={styles.helperText}>{copy.galleryHelper}</Text>
        <View style={styles.portfolioGrid}>
          {portfolioImages.map((img, i) => (
            <View key={i} style={styles.portfolioThumbWrap}>
              <Image source={{ uri: img }} style={styles.portfolioThumb} />
              <TouchableOpacity style={styles.removeBadge} onPress={() => handleRemovePortfolioImage(i)}>
                <Text style={styles.removeBadgeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {portfolioImages.length < MAX_PORTFOLIO_IMAGES && (
            <TouchableOpacity style={styles.addPortfolioBtn} onPress={handleAddPortfolioImage} disabled={isAddingPortfolio}>
              {isAddingPortfolio ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <MaterialCommunityIcons name="plus" size={24} color={colors.accent} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save Profile</Text>}
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: spacing.md,
  },
  backArrow: { color: colors.textPrimary, fontSize: 20 },
  headerTitle: { ...typography.cardTitle, fontSize: 17, color: colors.textPrimary },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.cardTitle, fontSize: 14, color: colors.textPrimary, marginBottom: 6 },
  helperText: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.sm, lineHeight: 17 },
  photoPicker: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPickerText: { color: colors.accent, fontSize: 11, fontWeight: '600', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  portfolioThumbWrap: { position: 'relative' },
  portfolioThumb: { width: 72, height: 72, borderRadius: 10 },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  addPortfolioBtn: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});

export default EditBusinessProfileScreen;
