import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { showAlert } from '../utils/crossPlatformAlert';
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from "../context/AuthContext";
import * as promotionApi from "../api/promotionApi";
import { Promotion } from "../types/marketplace";

const PAYSTACK_PUBLIC_KEY = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_224da5d5225a6d0cb4c95a2da7002ccf2fa3a7eb";

type Props = NativeStackScreenProps<RootStackParamList, 'PromotionPayment'>;

const escapeForJs = (value: string) => value.replace(/'/g, "\\'");

export default function PromotionPaymentScreen({ navigation, route }: Props) {
  const { promotionId } = route.params;
  const { user } = useAuth();

  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    promotionApi
      .getPromotionById(promotionId)
      .then((data) => {
        if (isMounted) setPromotion(data);
      })
      .catch((error) => console.warn('Failed to load promotion for payment', error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [promotionId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={{ color: "white", marginTop: 10 }}>Preparing payment...</Text>
      </SafeAreaView>
    );
  }

  if (!promotion) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white" }}>We couldn't find this promotion.</Text>
      </SafeAreaView>
    );
  }

  if (promotion.paymentStatus === 'paid') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white" }}>This promotion is already active.</Text>
      </SafeAreaView>
    );
  }

  if (isFinalizing) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={{ color: "white", marginTop: 10 }}>Confirming your payment...</Text>
      </SafeAreaView>
    );
  }

  const amount = Math.round(promotion.price * 100);
  const payerEmail = user?.email || "business@example.com";
  const nameParts = (user?.businessName || user?.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const payerPhone = user?.phone || "";

  const html = `
  <html>
    <body>
      <script src="https://js.paystack.co/v1/inline.js"></script>
      <script>
        function pay(){
          var handler = PaystackPop.setup({
            key: '${PAYSTACK_PUBLIC_KEY}',
            email: '${escapeForJs(payerEmail)}',
            firstname: '${escapeForJs(firstName)}',
            lastname: '${escapeForJs(lastName)}',
            phone: '${escapeForJs(payerPhone)}',
            amount: ${amount},
            currency: 'ZAR',
            metadata: { promotionId: '${escapeForJs(promotionId)}' },
            callback: function(response){
              window.ReactNativeWebView.postMessage(response.reference);
            },
            onClose: function(){
              window.ReactNativeWebView.postMessage("cancel");
            }
          });
          handler.openIframe();
        }
        pay();
      </script>
    </body>
  </html>
  `;

  const handleMessage = async (event: any) => {
    const data = event.nativeEvent.data;

    if (data === "cancel") {
      navigation.goBack();
      return;
    }

    setIsFinalizing(true);
    try {
      await promotionApi.payPromotion(promotionId, data);
      showAlert('Promotion Live!', 'Your promotion is now live and visible to clients.', [
        { text: 'OK', onPress: () => navigation.replace('MyPromotions') }
      ]);
    } catch (error: any) {
      console.error(error);
      setIsFinalizing(false);
      showAlert(
        "Payment Error",
        (error?.response?.data?.message || "Something went wrong confirming your payment") +
          `\n\nYour payment reference was: ${data}\nPlease save this in case you need support.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WebView originWhitelist={["*"]} source={{ html }} onMessage={handleMessage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#0F1B2C",
    justifyContent: "center",
    alignItems: "center"
  }
});