import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import QRCode from 'qrcode';
import Colors from '@/constants/colors';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
}

export default function QRCodeDisplay({
  value,
  size = 200,
  backgroundColor = '#FFFFFF',
  color = '#000000',
}: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setQrDataUrl(null);
      return;
    }

    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(value, {
          width: size,
          margin: 2,
          color: {
            dark: color,
            light: backgroundColor,
          },
          errorCorrectionLevel: 'M',
        });
        setQrDataUrl(dataUrl);
        setError(null);
      } catch (err) {
        console.error('[QRCodeDisplay] Error generating QR code:', err);
        setError('QR-Code konnte nicht generiert werden');
        setQrDataUrl(null);
      }
    };

    generateQR();
  }, [value, size, backgroundColor, color]);

  if (error) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!qrDataUrl) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={{ uri: qrDataUrl }}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  errorText: {
    fontSize: 12,
    color: Colors.negative,
    textAlign: 'center',
    padding: 16,
  },
});
