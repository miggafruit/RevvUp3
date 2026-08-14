import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { showAlert } from '../utils/crossPlatformAlert';
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from "../context/AuthContext";
import { getOrderById, payOrder } from "../api/orderApi";
import { Order } from "../types/marketplace";
import PaystackCheckout from "../components/PaystackCheckout";

const PAYSTACK_PUBLIC_KEY = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_live_22278ba900dd630d93cfffbb18b9ee73cebd2f1a";

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

const escapeForJs = (value: string) => value.replace(/'/g, "\\'");

export default function PaymentScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getOrderById(orderId)
      .then((data) => {
        if (isMounted) setOrder(data);
      })
      .catch((error) => {
        console.warn('Failed to load order for payment', error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={{ color: "white", marginTop: 10 }}>Preparing payment...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white" }}>We couldn't find this order.</Text>
      </SafeAreaView>
    );
  }

  if (order.status !== 'confirmed') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white", textAlign: 'center', paddingHorizontal: 24 }}>
          {order.status === 'pending'
            ? "This order hasn't been accepted by the seller yet."
            : 'This order can no longer be paid for.'}
        </Text>
      </SafeAreaView>
    );
  }

  if (order.paymentStatus === 'paid') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white" }}>This order has already been paid.</Text>
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

  const amount = Math.round(order.totalAmount * 100);
  const payerEmail = user?.email || "customer@example.com";
  const nameParts = (user?.name || "").trim().split(/\s+/).filter(Boolean);
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
            metadata: { orderId: '${escapeForJs(orderId)}' },
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

  const handleMessage = async (data: string) => {
    if (data === "cancel") {
      navigation.goBack();
      return;
    }

    setIsFinalizing(true);
    try {
      await payOrder(orderId, data);
      navigation.replace("OrderConfirmation", { orderId });
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
      <PaystackCheckout html={html} onMessage={handleMessage} />
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