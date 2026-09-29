import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from "../context/AuthContext";
import { getRequest, payRide } from "../api/ehailingApi";
import { Ride } from "../types/ehailing";
import PaystackCheckout from "../components/PaystackCheckout";
import { getPaystackPublicKey } from "../utils/paystackConfig";
import { showAlert } from '../utils/crossPlatformAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'RidePayment'>;

const escapeForJs = (value: string) => value.replace(/'/g, "\\'");

// Card only, and this now runs BEFORE a job ever gets dispatched to a
// driver — not after it's completed. That's the actual mechanism
// behind "a request can only be sent once payment is successful": no
// driver is ever notified about a ride until payRide below confirms a
// real, verified charge (see ehailingController.createRequest/payRide).
// Cash payment for e-hailing has been removed entirely — it couldn't
// be verified the way a Paystack reference can, and paying upfront
// removes the reason it existed in the first place.
export default function RidePaymentScreen({ navigation, route }: Props) {
  const { rideId } = route.params;
  const { user } = useAuth();

  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

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

  if (ride.status !== 'awaiting_payment') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white", textAlign: 'center', paddingHorizontal: 24 }}>
          {ride.paymentStatus === 'paid'
            ? 'This request has already been paid — your driver has been notified.'
            : 'This request is no longer awaiting payment.'}
        </Text>
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

  const amount = Math.round(ride.fare * 100);
  const payerEmail = user?.email || "customer@example.com";
  const nameParts = (user?.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const payerPhone = user?.phone || "";

  let paystackPublicKey: string;
  try {
    paystackPublicKey = getPaystackPublicKey();
  } catch (error: any) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "white", textAlign: 'center', paddingHorizontal: 24 }}>
          {error.message}
        </Text>
      </SafeAreaView>
    );
  }

  const html = `
  <html>
    <body>
      <script src="https://js.paystack.co/v1/inline.js"></script>
      <script>
        function pay(){
          var handler = PaystackPop.setup({
            key: '${paystackPublicKey}',
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
      // Backing out of payment leaves the ride sitting in
      // 'awaiting_payment' — nothing was ever dispatched, so there's
      // nothing to clean up beyond letting the client go back to
      // either retry or cancel the request outright from there.
      navigation.goBack();
      return;
    }

    setIsFinalizing(true);
    try {
      await payRide(rideId, data);
      // This is the moment the request actually gets sent to nearby
      // drivers (see payRide) — resuming into EHailingClient picks up
      // the now-'pending' ride and shows live "searching for driver"
      // tracking immediately, the same screen used for the rest of the
      // ride's lifecycle.
      navigation.replace('EHailingClient', { resumeRideId: rideId });
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
});
