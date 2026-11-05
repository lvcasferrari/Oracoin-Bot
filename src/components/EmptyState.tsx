import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Wordmark } from './Brand';
import { Button } from './form';
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
      <Wordmark />
      <Text style={styles.title}>{EMPTY_TITLE}</Text>
      <Text style={styles.body}>{EMPTY_BODY}</Text>
      <Button title="Começar" onPress={() => navigation.navigate('Onboarding')} />
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
  title: { fontSize: 26, fontWeight: '600', marginTop: 28 },
  body: { fontSize: 16, color: '#4F576B', marginBottom: 12 },
  secondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { fontSize: 14, opacity: 0.6 },
});
