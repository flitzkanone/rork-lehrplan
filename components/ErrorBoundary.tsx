import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error.message);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <AlertTriangle size={32} color={Colors.negative} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Etwas ist schiefgelaufen</Text>
            <Text style={styles.subtitle}>
              Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.
            </Text>
            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
                <Text style={styles.errorText}>{this.state.error.message}</Text>
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={this.handleReset}
              activeOpacity={0.7}
            >
              <RotateCcw size={16} color={Colors.white} strokeWidth={2} />
              <Text style={styles.resetBtnText}>Erneut versuchen</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.negativeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  errorBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorBoxContent: {
    padding: 14,
  },
  errorText: {
    fontSize: 12,
    color: Colors.negative,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  resetBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
