import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

interface Props {
  html: string;
  onMessage: (data: string) => void;
}

// On web there's no WebView (react-native-webview is native-only) — and
// there's no need for one, since the app is already running in a real
// browser. Instead we load Paystack's inline script directly onto the page
// and call PaystackPop.setup() natively, using the same `html` string the
// native version renders inside a WebView — we just extract and run the
// pay() function it defines rather than embedding it in an iframe.
const PaystackCheckout: React.FC<Props> = ({ html, onMessage }) => {
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Expose the same message bridge the native WebView provides, so the
    // inline <script> in `html` (written for window.ReactNativeWebView)
    // works unmodified on web too.
    (window as any).ReactNativeWebView = {
      postMessage: (data: string) => onMessage(data)
    };

    const scriptTag = document.createElement('script');
    scriptTag.src = 'https://js.paystack.co/v1/inline.js';
    scriptTag.onload = () => {
      // Extract the inline <script>...</script> body from the html string
      // (everything after the Paystack SDK <script> tag) and execute it,
      // since it defines and calls pay().
      const match = html.match(/<script>\s*function pay\(\)[\s\S]*?<\/script>/);
      if (match) {
        const inlineScript = document.createElement('script');
        inlineScript.text = match[0].replace(/<\/?script>/g, '');
        document.body.appendChild(inlineScript);
      }
    };
    document.body.appendChild(scriptTag);

    return () => {
      delete (window as any).ReactNativeWebView;
    };
  }, [html, onMessage]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#F97316" />
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default PaystackCheckout;