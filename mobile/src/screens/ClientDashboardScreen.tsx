import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ImageBackground, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientDashboard'>;

const ClientDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const features = [
    {
      icon: () => <Feather name="search" size={22} color={colors.accent} />,
      title: 'Find Providers',
      desc: 'Verified mechanics near you',
      screen: 'ProvidersList',
    },
    {
      icon: () => <MaterialCommunityIcons name="truck-delivery" size={22} color={colors.accent} />,
      title: 'E-Hailing',
      desc: 'Roadside help, fast',
      screen: 'EHailingClient',
    },
    {
      icon: () => <FontAwesome5 name="tools" size={20} color={colors.accent} />,
      title: 'RevvUp Shop',
      desc: 'Parts & accessories',
      screen: 'ShopsList',
    },
    {
      icon: () => <Feather name="file-text" size={22} color={colors.accent} />,
      title: 'My Orders',
      desc: 'Track your requests',
      screen: 'Orders',
    },
    {
      icon: () => <MaterialCommunityIcons name="history" size={22} color={colors.accent} />,
      title: 'Request History',
      desc: 'Past roadside requests',
      screen: 'EHailingHistory',
    },
    {
      icon: () => <Feather name="percent" size={22} color={colors.accent} />,
      title: 'Promotions',
      desc: 'View current promotions',
      screen: 'Promotions',
    },
  ];

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>

        {/* HEADER */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Welcome back</Text>
            <Text style={styles.greeting}>{firstName}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Cart')}>
              <Feather name="shopping-cart" size={20} color={colors.textPrimary} />
              {itemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{itemCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
              <Feather name="log-out" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* HERO */}
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600' }}
          style={styles.heroBanner}
          imageStyle={{ borderRadius: radius.lg }}
        >
          <View style={styles.heroOverlay}>
            <View style={styles.heroBadge}>
              <Feather name="zap" size={12} color={colors.accent} />
              <Text style={styles.heroBadgeText}>All-in-one platform</Text>
            </View>
            <Text style={styles.heroTitle}>All your car needs,{'\n'}one platform</Text>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => navigation.navigate('ServicesBrowse')}
            >
              <Text style={styles.heroButtonText}>Browse services</Text>
              <Feather name="arrow-right" size={15} color={colors.white} />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* SECTION HEADER */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>

        {/* FEATURES GRID */}
        <View style={styles.featuresGrid}>
          {features.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.featureCard}
              onPress={() => navigation.navigate(item.screen as any)}
              activeOpacity={0.7}
            >
              <View style={styles.featureIconWrap}>{item.icon()}</View>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureDesc}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* PROMO STRIP */}
        <TouchableOpacity
          style={styles.promoStrip}
          onPress={() => navigation.navigate('ShopsList')}
          activeOpacity={0.8}
        >
          <View style={styles.promoIconWrap}>
            <Feather name="percent" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.promoTitle}>New parts just dropped</Text>
            <Text style={styles.promoDesc}>Check out the latest stock from local shops</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },

  // HEADER
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  eyebrow: { color: colors.textMuted, fontSize: 12.5, marginBottom: 2 },
  greeting: { ...typography.title, color: colors.textPrimary, fontSize: 24 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.accent,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },

  // HERO
  heroBanner: { height: 200, marginHorizontal: spacing.lg, marginBottom: spacing.xl },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,27,44,0.55)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,27,44,0.8)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  heroBadgeText: { color: colors.white, fontSize: 11.5, fontWeight: '600' },
  heroTitle: { color: colors.white, fontSize: 22, fontWeight: '700', lineHeight: 28, marginBottom: spacing.md },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  heroButtonText: { color: colors.white, fontWeight: '700', fontSize: 13.5 },

  // SECTION
  sectionHeaderRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },

  // FEATURES GRID
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  featureCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featureTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  featureDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },

  // PROMO STRIP
  promoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
  },
  promoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 13.5, marginBottom: 1 },
  promoDesc: { color: colors.textMuted, fontSize: 12 },
});

export default ClientDashboardScreen;