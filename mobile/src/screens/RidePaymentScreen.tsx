import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { showAlert } from '../utils/crossPlatformAlert';
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from "../context/AuthContext";
import { getRequest, payRide, payCash } from "../api/ehailingApi";
import { Ride } from "../types/ehailing";
import PaystackCheckout from "../components/PaystackCheckout";

const PAYSTACK_PUBLIC_KEY = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_224da5d5225a6d0cb4c95a2da7002ccf2fa3a7eb";

type Props = NativeStackScreenProps<RootStackParamList, 'RidePayment'>;

const escapeForJs = (value: string) => value.replace(/'/g, "\\'");

export default function RidePaymentScreen({ navigation, route }: Props) {
  const { rideId } = route.params;
  const { user } = useAuth();

  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | null>(null);
  const [isPayingCash, setIsPayingCash] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getRequest(rideId)
      .then((res) => {
        if (isMounted) setRide(res.data);
      })
      .catch((error) => {
        console.warn('Failed to load request for payment', error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [rideId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={{ color: "white", marginTop: 10 }}>Preparing payment...</Text>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white" }}>We couldn't find this request.</Text>
      </SafeAreaView>
    );
  }

  if (ride.status !== 'completed') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white", textAlign: 'center', paddingHorizontal: 24 }}>
          This request hasn't been completed yet.
        </Text>
      </SafeAreaView>
    );
  }

  if (ride.paymentStatus === 'paid') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white" }}>This request has already been paid.</Text>
      </SafeAreaView>
    );
  }

  if (!ride.fare) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white" }}>This request has no fare recorded.</Text>
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

  const handlePayCash = () => {
    showAlert(
      'Pay by cash',
      `Confirm you've handed over R${ride.fare!.toFixed(2)} in cash to the driver directly. This just records it in the app — the payment itself already happened outside it.`,
      [
        { text: 'Not yet' },
        {
          text: 'Confirm',
          onPress: async () => {
            setIsPayingCash(true);
            try {
              await payCash(rideId);
              navigation.replace('EHailingHistory');
            } catch (error: any) {
              setIsPayingCash(false);
              showAlert('Error', error?.response?.data?.message || 'Could not record cash payment. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (isPayingCash) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={{ color: "white", marginTop: 10 }}>Recording your payment...</Text>
      </SafeAreaView>
    );
  }

  if (!paymentMethod) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.choiceTitle}>R{ride.fare!.toFixed(2)} due</Text>
        <Text style={styles.choiceSubtitle}>How would you like to pay?</Text>

        <TouchableOpacity style={styles.choiceButton} onPress={() => setPaymentMethod('card')}>
          <Text style={styles.choiceButtonText}>Pay with Card</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.choiceButton, styles.choiceButtonOutline]} onPress={handlePayCash}>
          <Text style={[styles.choiceButtonText, styles.choiceButtonTextOutline]}>Pay Cash</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const amount = Math.round(ride.fare * 100);
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
            metadata: { rideId: '${escapeForJs(rideId)}' },
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
      setPaymentMethod(null);
      return;
    }

    setIsFinalizing(true);
    try {
      await payRide(rideId, data);
      navigation.replace("EHailingHistory");
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
    alignItems: "center",
    paddingHorizontal: 24,
  },
  choiceTitle: { color: "white", fontSize: 28, fontWeight: "800", marginBottom: 6 },
  choiceSubtitle: { color: "#9CA3AF", fontSize: 15, marginBottom: 28 },
  choiceButton: {
    backgroundColor: "#F97316",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  choiceButtonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#F97316",
  },
  choiceButtonText: { color: "white", fontSize: 16, fontWeight: "700" },
  choiceButtonTextOutline: { color: "#F97316" },
});
