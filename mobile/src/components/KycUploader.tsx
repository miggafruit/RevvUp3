import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, StyleSheet } from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import * as ImagePicker from 'expo-image-picker';
import { KycDocument } from '../types/auth';
import { colors } from '../theme/colors';

interface Props {
  role: 'shop' | 'service_provider';
  documents: KycDocument[];
  onChange: (docs: KycDocument[]) => void;
}

const SHOP_SLOTS: Array<{ type: KycDocument['type']; label: string; hint: string }> = [
  { type: 'id_document', label: "Owner's ID / Passport", hint: "A clear photo of the business owner's ID or passport" },
  { type: 'business_registration', label: 'Business Registration', hint: 'CIPC registration certificate or business license' },
  { type: 'proof_of_address', label: 'Proof of Business Address', hint: 'A recent utility bill or lease agreement for the shop' }
];

const SERVICE_PROVIDER_SLOTS: Array<{ type: KycDocument['type']; label: string; hint: string }> = [
  { type: 'id_document', label: 'ID / Passport', hint: 'A clear photo of your ID or passport' },
  { type: 'drivers_license', label: "Driver's License", hint: "Needed if you'll be doing roadside assistance or deliveries" },
  { type: 'proof_of_address', label: 'Proof of Address', hint: 'A recent utility bill or bank statement' },
  { type: 'selfie', label: 'Selfie', hint: 'A clear photo of your face, for identity verification' }
];

const pickImage = async (): Promise<string | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showAlert('Permission Needed', 'Please allow photo library access to upload a document.');
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

const KycUploader: React.FC<Props> = ({ role, documents, onChange }) => {
  const [customLabel, setCustomLabel] = useState('');

  const suggestedSlots = role === 'shop' ? SHOP_SLOTS : SERVICE_PROVIDER_SLOTS;

  const findDoc = (type: KycDocument['type']) => documents.find((d) => d.type === type);

  const handlePickForSlot = async (type: KycDocument['type'], label: string) => {
    const image = await pickImage();
    if (!image) return;

    const existing = findDoc(type);
    if (existing) {
      onChange(documents.map((d) => (d.id === existing.id ? { ...d, image } : d)));
    } else {
      onChange([...documents, { id: `${type}-${Date.now()}`, type, label, image }]);
    }
  };

  const handleRemove = (id: string) => {
    onChange(documents.filter((d) => d.id !== id));
  };

  const handleAddOther = async () => {
    const image = await pickImage();
    if (!image) return;
    const label = customLabel.trim() || 'Additional Document';
    onChange([...documents, { id: `other-${Date.now()}`, type: 'other', label, image }]);
    setCustomLabel('');
  };

  const otherDocs = documents.filter((d) => d.type === 'other');

  return (
    <View>
      <Text style={styles.sectionNote}>
        Optional — you can add these now or later from your profile. Uploading helps us verify
        your account faster.
      </Text>

      {suggestedSlots.map((slot) => {
        const doc = findDoc(slot.type);
        return (
          <View key={slot.type} style={styles.slotRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.slotLabel}>{slot.label}</Text>
              <Text style={styles.slotHint}>{slot.hint}</Text>
            </View>

            {doc ? (
              <View style={styles.thumbWrap}>
                <Image source={{ uri: doc.image }} style={styles.thumb} />
                <TouchableOpacity onPress={() => handleRemove(doc.id)} style={styles.removeBadge}>
                  <Text style={styles.removeBadgeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handlePickForSlot(slot.type, slot.label)}
              >
                <Text style={styles.uploadButtonText}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {otherDocs.map((doc) => (
        <View key={doc.id} style={styles.slotRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.slotLabel}>{doc.label}</Text>
          </View>
          <View style={styles.thumbWrap}>
            <Image source={{ uri: doc.image }} style={styles.thumb} />
            <TouchableOpacity onPress={() => handleRemove(doc.id)} style={styles.removeBadge}>
              <Text style={styles.removeBadgeText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.addOtherRow}>
        <TextInput
          style={styles.addOtherInput}
          value={customLabel}
          onChangeText={setCustomLabel}
          placeholder={
            role === 'shop' ? 'e.g. Tax Clearance Certificate' : 'e.g. Vehicle Registration / Roadworthy Certificate'
          }
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity style={styles.addMoreButton} onPress={handleAddOther}>
          <Text style={styles.addMoreButtonText}>+ Add Document</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionNote: { color: colors.textMuted, fontSize: 12.5, marginBottom: 12, lineHeight: 18 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  slotLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  slotHint: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  uploadButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  uploadButtonText: { color: colors.accent, fontWeight: '700', fontSize: 12.5 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  addOtherRow: { marginTop: 14, gap: 8 },
  addOtherInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    color: colors.textPrimary
  },
  addMoreButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  addMoreButtonText: { color: colors.accent, fontWeight: '700', fontSize: 13.5 }
});

export default KycUploader;