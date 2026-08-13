import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius } from '../theme/colors';

interface ImagePickerFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

const ImagePickerField: React.FC<ImagePickerFieldProps> = ({ images, onChange, maxImages = 5 }) => {
  const pickImage = async () => {
    if (images.length >= maxImages) {
      showAlert('Limit Reached', `You can add up to ${maxImages} images`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission Required', 'Please allow photo library access to add images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
      allowsEditing: true,
      aspect: [4, 3]
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const mimeType = result.assets[0].mimeType || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${result.assets[0].base64}`;
      onChange([...images, dataUri]);
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {images.map((uri, index) => (
          <View key={index} style={styles.imageWrapper}>
            <Image source={{ uri }} style={styles.image} />
            <TouchableOpacity style={styles.removeBadge} onPress={() => removeImage(index)}>
              <Text style={styles.removeBadgeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {images.length < maxImages && (
          <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
            <Text style={styles.addImageButtonText}>+</Text>
            <Text style={styles.addImageLabel}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Text style={styles.helperText}>
        {images.length}/{maxImages} images added
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  imageWrapper: { position: 'relative' },
  image: { width: 88, height: 88, borderRadius: radius.md },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  addImageButton: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  addImageButtonText: { color: colors.accent, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  addImageLabel: { color: colors.textMuted, fontSize: 10.5, marginTop: 2 },
  helperText: { color: colors.textMuted, fontSize: 11.5, marginTop: spacing.xs }
});

export default ImagePickerField;
