import { getStateFromPath as defaultGetStateFromPath, type LinkingOptions } from '@react-navigation/native';
import { Platform } from 'react-native';
import type { RootStackParamList } from '../types/navigation';

// On web, this is what makes the browser (and phone-browser) back button
// step through the app's screens instead of leaving the site: every screen
// gets its own URL, so each navigation adds a history entry.
//
// The URL a page is OPENED on is deliberately ignored (the getStateFromPath override), so
// typing/refreshing a URL can never put a logged-out visitor on a dashboard:
// the starting screen is still decided by the login state.
const screenPaths: Record<keyof RootStackParamList, string> = {
  Welcome: 'welcome',
  Login: 'login',
  RegisterRoleSelect: 'register-role-select',
  Register: 'register',
  RegisterDriver: 'register-driver',
  ForgotPassword: 'forgot-password',
  ResetPassword: 'reset-password',
  ClientDashboard: 'client-dashboard',
  ServiceProviderDashboard: 'service-provider-dashboard',
  EditAvailability: 'edit-availability',
  KycStatus: 'kyc-status',
  ShopDashboard: 'shop-dashboard',
  ShopsList: 'shops-list',
  ShopDetail: 'shop-detail',
  ProvidersList: 'providers-list',
  ProviderDetail: 'provider-detail',
  ProductsBrowse: 'products-browse',
  ServicesBrowse: 'services-browse',
  ProductDetail: 'product-detail',
  ServiceDetail: 'service-detail',
  Cart: 'cart',
  Checkout: 'checkout',
  Payment: 'payment',
  OrderConfirmation: 'order-confirmation',
  Orders: 'orders',
  RateOrder: 'rate-order',
  IncomingOrders: 'incoming-orders',
  PartInquiries: 'part-inquiries',
  MyInquiries: 'my-inquiries',
  Notifications: 'notifications',
  Rewards: 'rewards',
  RewardsProgram: 'rewards-program',
  Earnings: 'earnings',
  EditBusinessProfile: 'edit-business-profile',
  BusinessAddress: 'business-address',
  IncomingDeliveries: 'incoming-deliveries',
  DeliveryTracking: 'delivery-tracking',
  Promotions: 'promotions',
  CreatePromotion: 'create-promotion',
  PromotionPayment: 'promotion-payment',
  MyPromotions: 'my-promotions',
  MyProducts: 'my-products',
  ProductForm: 'product-form',
  MyServices: 'my-services',
  ServiceForm: 'service-form',
  EHailingClient: 'e-hailing-client',
  EHailingDriver: 'e-hailing-driver',
  EHailingHistory: 'e-hailing-history',
  RidePayment: 'ride-payment',
};

let firstCallAt: number | null = null;

export const linking: LinkingOptions<RootStackParamList> | undefined =
  Platform.OS === 'web'
    ? {
        prefixes: [],
        config: { screens: screenPaths },
        // Ignore the URL the page was opened on (first moments only); back/forward
        // afterwards are parsed normally.
        getStateFromPath: (path, options) =>
{
          if (firstCallAt === null) firstCallAt = Date.now();
          return Date.now() - firstCallAt < 2000 ? undefined : defaultGetStateFromPath(path, options);
        }
      }
    : undefined;
