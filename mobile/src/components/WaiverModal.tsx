import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface WaiverModalProps {
  visible: boolean;
  onAccept: () => void;
  onClose: () => void;
}

const WAIVER_TEXT = `1. REVVUP TERMS OF SERVICE
Last Updated: 05 June 2026
1. ACKNOWLEDGMENT AND ACCEPTANCE OF TERMS
By downloading, accessing, or using the RevvUp mobile application ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.
2. NATURE OF THE PLATFORM
2.1 RevvUp operates as a technology platform that connects vehicle owners ("Users") with independent automotive service providers ("Providers").
2.2 RevvUp does not:
Employ, endorse, or guarantee any Provider
Perform automotive services
Warrant the quality, safety, or legality of services provided
Assume responsibility for Provider actions or omissions
3. USER RESPONSIBILITIES
3.1 You must:
Be 18 years or older and have legal capacity to enter contracts
Provide accurate information about yourself and your vehicle
Verify Provider qualifications, insurance, and licensing before services
Supervise or inspect work if you have safety concerns
3.2 You must not:
Use the App for illegal purposes
Book services you do not intend to pay for
Harass, threaten, or harm other users or Providers
Misrepresent your identity or vehicle information
4. PAYMENTS AND TRANSACTIONS
4.1 All payments are made directly to Providers. RevvUp is not a party to payment transactions.
4.2 You agree to pay the agreed price for services rendered.
4.3 Disputes regarding payments or service quality must be resolved directly with the Provider.
5. ACCOUNT SUSPENSION AND TERMINATION
RevvUp may suspend or terminate your account if you violate these terms, engage in fraudulent activity, or misuse the platform.




2. REVVUP LIMITED LIABILITY WAIVER
IMPORTANT NOTICE: READ CAREFULLY BEFORE ACCEPTING
This waiver affects your legal rights. By accepting, you assume all risks associated with automotive services obtained through the RevvUp platform.
1. ACKNOWLEDGMENT OF INHERENT RISKS
You understand that automotive services carry inherent risks including, but not limited to:
Personal injury or death from improper repairs
Vehicle damage or total loss
Financial loss from incorrect diagnoses or poor workmanship
Property damage at service locations
2. RELEASE OF LIABILITY
To the fullest extent permitted by South African law, you hereby release, discharge, and hold harmless RevvUp Pty Ltd, its directors, employees, agents, and affiliates from any and all liability, claims, demands, damages, or causes of action arising from:
Services performed by Providers
Your interactions with Providers
Vehicle damage, personal injury, or financial loss
Provider negligence, errors, or omissions
Any disputes between you and a Provider
3. ASSUMPTION OF RISK
You voluntarily assume full responsibility for:
Verifying Provider qualifications and insurance
Ensuring correct service specifications
Supervising work if you have concerns
Any consequences of services performed on your vehicle
4. INDEMNIFICATION
You agree to indemnify and defend RevvUp against any claims, damages, losses, or expenses (including legal fees) arising from your use of the App or services obtained through it.
5. NO WARRANTIES
RevvUp provides the platform "as is" without warranties of any kind, express or implied, including warranties of merchantability, fitness for purpose, or safety.




REVVUP PRIVACY CONSENT (POPIA COMPLIANT)
DATA PROTECTION NOTICE
This notice explains how we collect, use, and protect your personal information in compliance with South Africa's Protection of Personal Information Act (POPIA).
1. INFORMATION WE COLLECT
1.1 Personal Information:
Name, contact details, and identification information
Vehicle information (make, model, registration)
Location data (for service delivery and mapping)
1.2 Service Information:
Booking history and preferences
Service records and invoices
Communications with Providers
Payment transaction records
1.3 Technical Information:
Device information and IP address
App usage statistics
Cookies and similar technologies
2. HOW WE USE YOUR INFORMATION
2.1 To Provide Services:
Facilitate bookings and connections with Providers
Process transactions and rewards
Send service-related communications
Maintain your service history
2.2 To Improve Our Platform:
Analyze usage patterns
Develop new features
Conduct research and surveys
2.3 For Legal and Security Purposes:
Comply with legal obligations
Prevent fraud and abuse
Enforce our terms and conditions
3. SHARING YOUR INFORMATION
3.1 We share your information with:
Providers: Necessary information to complete bookings
Payment Processors: To facilitate transactions
Service Partners: For rewards and promotions (with opt-out)
Legal Authorities: When required by law
3.2 We do not sell your personal information to third parties.
4. DATA SECURITY
We implement reasonable technical and organizational measures to protect your information, but cannot guarantee absolute security.
5. YOUR RIGHTS UNDER POPIA
You have the right to:
Access your personal information
Correct inaccurate information
Request deletion of your information (subject to legal requirements)
Object to processing of your information
Lodge a complaint with the Information Regulator
6. DATA RETENTION
We retain your information for as long as necessary to provide services, comply with legal obligations, resolve disputes, and enforce agreements.
7. CONTACT INFORMATION
Information Officer: [Your Name/Designated Person]
Email: [Your Email Address]
Physical Address: [Your Business Address]


`;

const WaiverModal: React.FC<WaiverModalProps> = ({ visible, onAccept, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Waiver & Terms</Text>
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.bodyText}>{WAIVER_TEXT}</Text>
        </ScrollView>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.declineButton} onPress={onClose}>
            <Text style={styles.declineButtonText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
            <Text style={styles.acceptButtonText}>I Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: colors.textPrimary
  },
  scrollArea: {
    flex: 1,
    marginBottom: 16
  },
  scrollContent: {
    paddingBottom: 20
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  declineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  declineButtonText: {
    color: colors.textSecondary,
    fontWeight: '600'
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center'
  },
  acceptButtonText: {
    color: colors.white,
    fontWeight: '600'
  }
});

export default WaiverModal;
