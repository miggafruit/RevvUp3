import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from './navigationRef';
import { colors } from '../theme/colors';

import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterRoleSelectScreen from '../screens/RegisterRoleSelectScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ClientDashboardScreen from '../screens/ClientDashboardScreen';
import ServiceProviderDashboardScreen from '../screens/ServiceProviderDashboardScreen';
import EditAvailabilityScreen from '../screens/EditAvailabilityScreen';
import KycStatusScreen from '../screens/KycStatusScreen';
import ShopDashboardScreen from '../screens/ShopDashboardScreen';

import ShopsListScreen from '../screens/ShopsListScreen';
import ShopDetailScreen from '../screens/ShopDetailScreen';
import ProvidersListScreen from '../screens/ProvidersListScreen';
import ProviderDetailScreen from '../screens/ProviderDetailScreen';
import ProductsBrowseScreen from '../screens/ProductsBrowseScreen';
import ServicesBrowseScreen from '../screens/ServicesBrowseScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import ServiceDetailScreen from '../screens/ServiceDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';

import MyProductsScreen from '../screens/MyProductsScreen';
import ProductFormScreen from '../screens/ProductFormScreen';
import MyServicesScreen from '../screens/MyServicesScreen';
import ServiceFormScreen from '../screens/ServiceFormScreen';

// eHailing screens
import EHailingClientScreen from '../screens/EHailingClientScreen';
import EHailingDriverScreen from '../screens/EHailingDriverScreen';
import EHailingHistoryScreen from '../screens/EHailingHistoryScreen';
import RidePaymentScreen from '../screens/RidePaymentScreen';

// forgot password screen
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
// payment screen
import PaymentScreen from '../screens/PaymentScreen';

// incoming orders screen
import OrdersScreen from '../screens/OrdersScreen';
import RateOrderScreen from '../screens/RateOrderScreen';
import IncomingOrdersScreen from '../screens/IncomingOrdersScreen';

// promotions
import PromotionsScreen from '../screens/PromotionsScreen';
import CreatePromotionScreen from '../screens/CreatePromotionScreen';
import PromotionPaymentScreen from '../screens/PromotionPaymentScreen';
import MyPromotionsScreen from '../screens/MyPromotionsScreen';

// driver registration screen
import RegisterDriverScreen from '../screens/RegisterDriverScreen';

//delivery screens

import IncomingDeliveriesScreen from '../screens/IncomingDeliveriesScreen';
import DeliveryTrackingScreen from '../screens/DeliveryTrackingScreen';



const Stack = createNativeStackNavigator<RootStackParamList>();

const getInitialRouteForRole = (role?: string): keyof RootStackParamList => {
  if (role === 'client') return 'ClientDashboard';
  if (role === 'service_provider') return 'ServiceProviderDashboard';
  if (role === 'shop') return 'ShopDashboard';
  return 'Welcome';
};

const RootNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const initialRouteName = getInitialRouteForRole(user?.role);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator id={undefined} initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
        {/* Auth */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="RegisterRoleSelect" component={RegisterRoleSelectScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />

        {/* Dashboards */}
        <Stack.Screen name="ClientDashboard" component={ClientDashboardScreen} />
        <Stack.Screen name="ServiceProviderDashboard" component={ServiceProviderDashboardScreen} />
        <Stack.Screen name="EditAvailability" component={EditAvailabilityScreen} />
        <Stack.Screen name="KycStatus" component={KycStatusScreen} />
        <Stack.Screen name="ShopDashboard" component={ShopDashboardScreen} />

        {/* Client browsing */}
        <Stack.Screen name="ShopsList" component={ShopsListScreen} />
        <Stack.Screen name="ShopDetail" component={ShopDetailScreen} />
        <Stack.Screen name="ProvidersList" component={ProvidersListScreen} />
        <Stack.Screen name="ProviderDetail" component={ProviderDetailScreen} />
        <Stack.Screen name="ProductsBrowse" component={ProductsBrowseScreen} />
        <Stack.Screen name="ServicesBrowse" component={ServicesBrowseScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} />

        {/* Shop management */}
        <Stack.Screen name="MyProducts" component={MyProductsScreen} />
        <Stack.Screen name="ProductForm" component={ProductFormScreen} />

        {/* Service provider management */}
        <Stack.Screen name="MyServices" component={MyServicesScreen} />
        <Stack.Screen name="ServiceForm" component={ServiceFormScreen} />

        {/* eHailing — client books, service_provider accepts */}
        <Stack.Screen name="EHailingClient" component={EHailingClientScreen} />
        <Stack.Screen name="EHailingDriver" component={EHailingDriverScreen} />
        <Stack.Screen name="EHailingHistory" component={EHailingHistoryScreen} />
        <Stack.Screen name="RidePayment" component={RidePaymentScreen} />

        {/* Forgot Password */}
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false }} />

        {/* Payment */}
        <Stack.Screen name="Payment" component={PaymentScreen} />

        {/* Orders */}
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="RateOrder" component={RateOrderScreen} />
        <Stack.Screen name="IncomingOrders" component={IncomingOrdersScreen} />

        {/* Promotions */}
        <Stack.Screen name="Promotions" component={PromotionsScreen} />
        <Stack.Screen name="CreatePromotion" component={CreatePromotionScreen} />
        <Stack.Screen name="PromotionPayment" component={PromotionPaymentScreen} />
        <Stack.Screen name="MyPromotions" component={MyPromotionsScreen} />

        {/* Driver Registration */}
        <Stack.Screen name="RegisterDriver" component={RegisterDriverScreen} />

        {/* Delivery */}
        <Stack.Screen name="IncomingDeliveries" component={IncomingDeliveriesScreen} />
        <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background
  }
});

export default RootNavigator;