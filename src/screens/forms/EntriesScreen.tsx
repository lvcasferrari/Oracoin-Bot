import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Entry, Profile } from '../../engine';
import { Button } from '../../components/form';
import { Money } from '../../components/ui';
import { CATEGORY_LABELS } from '../../lib/banks';
import { formatDateBR, shortMonth } from '../../lib/dateInput';
import type { FluxoStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';

function describe(entry: Entry, profile: Profile): string {
  const when =
    entry.recurrence === 'once'
      ? `em ${formatDateBR(entry.date ?? '')}`
      : entry.recurrence === 'yearly'
        ? `todo ano, dia ${entry.day} de ${shortMonth(entry.startMonth).slice(0, 3)}`
        : `todo dia ${entry.day}`;
  const card = entry.cardId ? profile.cards.find((c) => c.id === entry.cardId) : undefined;
  const parts = [when, card ? `no cartão ${card.bank}` : undefined, entry.category ? CATEGORY_LABELS[entry.category] : undefined];
  return parts.filter(Boolean).join(' · ');
}

export function EntriesScreen({ navigation }: NativeStackScreenProps<FluxoStackParamList, 'Lancamentos'>) {
  const { profile } = useReadyData();
  const groups = [
    { title: 'Entradas', kind: 'in' as const, items: profile.entries.filter((e) => e.kind === 'in') },
    { title: 'Saídas', kind: 'out' as const, items: profile.entries.filter((e) => e.kind === 'out') },
  ];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {groups.map((g) => (
        <View key={g.kind} style={styles.group}>
          <Text style={styles.title} accessibilityRole="header">
            {g.title}
          </Text>
          {g.items.length === 0 && <Text style={styles.empty}>Nada por aqui ainda.</Text>}
          {g.items.map((e) => (
            <Pressable key={e.id} style={styles.row} onPress={() => navigation.navigate('EntryForm', { id: e.id })} accessibilityRole="button" accessibilityHint="Editar lançamento">
              <View style={styles.flex}>
                <Text style={styles.name}>{e.name}</Text>
                <Text style={styles.meta}>{describe(e, profile)}</Text>
              </View>
              <Money value={e.amount} style={styles.amount} />
            </Pressable>
          ))}
          <Button title={g.kind === 'in' ? 'Nova entrada' : 'Nova saída'} kind="secondary" onPress={() => navigation.navigate('EntryForm', { kind: g.kind })} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 20 },
  group: { gap: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  empty: { fontSize: 14, opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#8884' },
  flex: { flex: 1 },
  name: { fontSize: 16 },
  meta: { fontSize: 13, opacity: 0.6 },
  amount: { fontSize: 16, fontWeight: '500' },
});
