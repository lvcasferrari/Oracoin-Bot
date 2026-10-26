import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { loadSample } from '../data/loadSample';
import { EMPTY_BODY, EMPTY_TITLE } from '../lib/copy';
import type { RootStackParamList } from '../navigation/types';
import { useReadyData } from '../state/AppData';

/** Shown on every tab until the user has entered something. */
export function EmptyState() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { db, today, refresh } = useReadyData();

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{EMPTY_TITLE}</Text>
      <Text style={styles.body}>{EMPTY_BODY}</Text>
      <Pressable style={styles.primary} onPress={() => navigation.navigate('Onboarding')} accessibilityRole="button">
        <Text style={styles.primaryText}>Começar</Text>
      </Pressable>
      {__DEV__ && (
        <Pressable
          style={styles.secondary}
          onPress={async () => {
            await loadSample(db, today);
            await refresh();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Dados de exemplo (só em desenvolvimento)</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  body: { fontSize: 16, opacity: 0.7 },
  primary: { minHeight: 48, marginTop: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2f6f4f' },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  secondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { fontSize: 14, opacity: 0.6 },
});
