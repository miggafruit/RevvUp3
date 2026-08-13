import React from 'react';
import { WebView } from 'react-native-webview';

interface Props {
  html: string;
  onMessage: (data: string) => void;
}

const PaystackCheckout: React.FC<Props> = ({ html, onMessage }) => {
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
    />
  );
};

export default PaystackCheckout;