import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { authColors } from '../theme/authColors';

const { height } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, 'RegisterRoleSelect'>;

const ROLES: { role: 'client' | 'service_provider' | 'shop'; title: string; description: string }[] = [
  {
    role: 'client',
    title: 'Client',
    description: 'Browse and buy car parts and book services'
  },
  {
    role: 'service_provider',
    title: 'Service Provider',
    description: 'Offer automotive services to clients'
  },
  {
    role: 'shop',
    title: 'Shop',
    description: 'Sell car parts and products to clients'
  }
];

const RegisterRoleSelectScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create an Account</Text>
        <Text style={styles.subtitle}>How will you be using RevvUp?</Text>
      </View>

      <View style={styles.cardGroup}>
        {ROLES.map((item) => (
          <TouchableOpacity
            key={item.role}
            style={styles.card}
            onPress={() => navigation.navigate('Register', { role: item.role })}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('RegisterDriver')}>
          <Text style={styles.cardTitle}>Driver</Text>
          <Text style={styles.cardDescription}>
            Earn by delivering parts from shops and helping stranded drivers with roadside assistance
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
        <Text style={styles.loginLinkText}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    backgroundColor: authColors.background
  },
  header: {
    marginTop: height * 0.1,
    marginBottom: 32,
    alignItems: "center"
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: authColors.white,
    marginBottom: 6
  },
  subtitle: {
    fontSize: 15,
    color: authColors.textSecondary
  },
  cardGroup: {
    gap: 16,
    marginTop: 20
  },
  card: {
    backgroundColor: authColors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: authColors.border,
    elevation: 2
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: authColors.white,
    marginBottom: 6
  },
  cardDescription: {
    fontSize: 14,
    color: authColors.textSecondary
  },
  loginLink: {
    marginTop: 40,
    alignItems: "center"
  },
  loginLinkText: {
    color: authColors.green,
    fontWeight: "700",
    fontSize: 14
  }
});

export default RegisterRoleSelectScreen;