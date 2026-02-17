import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Modal' }} />
      <Text>Modal</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
