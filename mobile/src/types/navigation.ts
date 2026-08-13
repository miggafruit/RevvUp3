export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  RegisterRoleSelect: undefined;
  Register: { role: 'client' | 'service_provider' | 'shop' };
  RegisterDriver: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string } | undefined;
  ClientDashboard: undefined;
  ServiceProviderDashboard: undefined;
  EditAvailability: undefined;
  KycStatus: undefined;
  ShopDashboard: undefined;

  ShopsList: undefined;
  ShopDetail: { shopId: string; shopName: string };
  ProvidersList: undefined;
  ProviderDetail: { providerId: string; providerName: string };
  ProductsBrowse: { shopId?: string; shopName?: string } | undefined;
  ServicesBrowse: { providerId?: string; providerName?: string } | undefined;
  ProductDetail: { productId: string };
  ServiceDetail: { serviceId: string };
  Cart: undefined;
  Checkout: undefined;
  Payment: { orderId: string };
  OrderConfirmation: { orderId: string };
  Orders: undefined;
  RateOrder: { orderId: string };
  IncomingOrders: undefined;

  IncomingDeliveries: undefined;
  DeliveryTracking: { orderId: string };

  Promotions: undefined;
  CreatePromotion: undefined;
  PromotionPayment: { promotionId: string };
  MyPromotions: undefined;

  MyProducts: undefined;
  ProductForm: { productId?: string } | undefined;

  MyServices: undefined;
  ServiceForm: { serviceId?: string } | undefined;

  EHailingClient: { resumeRideId?: string } | undefined;
  EHailingDriver: { incomingRequest?: any } | undefined;
  EHailingHistory: undefined;
  RidePayment: { rideId: string };
};