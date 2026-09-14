import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { resubmitKyc, getMyBankingDetails, updateProfile } from '../api/authApi';
import { KycDocument } from '../types/auth';
import KycUploader from '../components/KycUploader';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'KycStatus'>;

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  not_submitted: { label: 'Not submitted', color: colors.textMuted, icon: 'file-question-outline' },
  pending: { label: 'Under review', color: '#F59E0B', icon: 'clock-outline' },
  approved: { label: 'Verified', color: colors.success, icon: 'check-decagram' },
  rejected: { label: 'Rejected', color: colors.danger, icon: 'alert-circle-outline' },
};

const KycStatusScreen: React.FC<Props> = ({ navigation }) => {
  const { user, setUser } = useAuth();
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankBranchCode, setBankBranchCode] = useState('');
  const [isLoadingBanking, setIsLoadingBanking] = useState(true);
  const [isSavingBanking, setIsSavingBanking] = useState(false);

  useEffect(() => {
    getMyBankingDetails()
      .then((bd) => {
        if (!bd) return;
        setBankAccountHolder(bd.accountHolder || '');
        setBankName(bd.bankName || '');
        setBankAccountNumber(bd.accountNumber || '');
        setBankBranchCode(bd.branchCode || '');
      })
      .catch(() => {
        // Not fatal — the fields just start blank, same as never having
        // submitted anything yet.
      })
      .finally(() => setIsLoadingBanking(false));
  }, []);

  const handleSaveBanking = async () => {
    if (!bankAccountHolder.trim() || !bankName.trim() || !bankAccountNumber.trim() || !bankBranchCode.trim()) {
      showAlert('Missing Information', 'Please fill in all banking fields — these are required before your account can be approved.');
      return;
    }
    setIsSavingBanking(true);
    try {
      const updated = await updateProfile({
        bankingDetails: {
          accountHolder: bankAccountHolder.trim(),
          bankName: bankName.trim(),
          accountNumber: bankAccountNumber.trim(),
          branchCode: bankBranchCode.trim()
        }
      });
      setUser(updated);
      showAlert('Saved', 'Your banking details have been updated.');
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.message || 'Could not save your banking details. Please try again.');
    } finally {
      setIsSavingBanking(false);
    }
  };

  const status = user?.kycStatus || 'not_submitted';
  const meta = STATUS_META[status];
  const canResubmit = status === 'rejected' || status === 'not_submitted';

  const handleSubmit = async () => {
    if (documents.length === 0) {
      showAlert('Add a document', 'Please upload at least one document before submitting.');
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await resubmitKyc(documents);
      setUser(updated);
      showAlert('Submitted', 'Your documents have been sent for review.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.message || 'Could not submit your documents. Please try again.');
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
        <Text style={styles.headerTitle}>Verification Status</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.statusCard, { borderColor: meta.color }]}>
          <MaterialCommunityIcons name={meta.icon as any} size={28} color={meta.color} />
          <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>

        {status === 'rejected' && (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Why it was rejected</Text>
            <Text style={styles.noteText}>
              {user?.kycReviewNote || 'No specific reason was given. Please make sure your documents are clear and up to date, then resubmit.'}
            </Text>
          </View>
        )}

        {status === 'pending' && (
          <Text style={styles.helperText}>
            Your documents are being reviewed. This usually doesn't take long — check back soon.
          </Text>
        )}

        {status === 'approved' && (
          <Text style={styles.helperText}>
            You're all set. No further action needed.
          </Text>
        )}

        <Text style={styles.sectionTitle}>Banking Details</Text>
        <Text style={styles.helperText}>
          This is where your payouts get sent. Required before your account can be approved.
        </Text>
        {isLoadingBanking ? (
          <ActivityIndicator color={colors.accent} style={{ marginBottom: 20 }} />
        ) : (
          <>
            <TextInput
              style={styles.bankInput}
              value={bankAccountHolder}
              onChangeText={setBankAccountHolder}
              placeholder="Account holder name"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.bankInput, { marginTop: 10 }]}
              value={bankName}
              onChangeText={setBankName}
              placeholder="Bank name"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.bankInput, { marginTop: 10 }]}
              value={bankAccountNumber}
              onChangeText={setBankAccountNumber}
              placeholder="Account number"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.bankInput, { marginTop: 10 }]}
              value={bankBranchCode}
              onChangeText={setBankBranchCode}
              placeholder="Branch code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={[styles.submitButton, { marginTop: 14 }, isSavingBanking && { opacity: 0.6 }]}
              onPress={handleSaveBanking}
              disabled={isSavingBanking}
            >
              {isSavingBanking ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Save Banking Details</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {canResubmit && (
          <>
            <Text style={styles.sectionTitle}>
              {status === 'rejected' ? 'Resubmit your documents' : 'Submit your documents'}
            </Text>
            <KycUploader
              role={(user?.role as 'shop' | 'service_provider') || 'service_provider'}
              documents={documents}
              onChange={setDocuments}
              showVehicleDocument={!!user?.isDriver || (user?.roadsideServices?.length ?? 0) > 0}
            />

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit for Review</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backArrow: { color: colors.textPrimary, fontSize: 20 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusLabel: { fontSize: 16, fontWeight: '700' },
  noteBox: {
    backgroundColor: colors.accentMuted,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  noteLabel: { fontSize: 12, fontWeight: '700', color: colors.danger, marginBottom: 4 },
  noteText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  helperText: { fontSize: 14, color: colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  bankInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary
  },
});

export default KycStatusScreen;
