import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnnounce } from '../components/form';
import { LOAD_ERROR } from '../lib/copy';
import { useAppData } from './AppData';

/** Shows loading and error states until the on-device data is open. */
export function DataGate({ children }: { children: ReactNode }) {
  const { status, retry } = useAppData();
  useAnnounce(status === 'error' ? LOAD_ERROR : undefined);
  if (status === 'ready') return <>{children}</>;
  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Carregando seus dados" />
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <Text style={styles.text}>{LOAD_ERROR}</Text>
      <Pressable style={styles.button} onPress={retry} accessibilityRole="button">
        <Text style={styles.buttonText}>Tentar de novo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  text: { fontSize: 16, textAlign: 'center' },
  button: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12, backgroundColor: '#2f6f4f' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
