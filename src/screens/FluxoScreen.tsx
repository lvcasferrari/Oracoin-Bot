import { FlatList, StyleSheet, Text, View } from 'react-native';
import { addMonths, buildEvents, cashProjection, monthOf, profileBalance } from '../engine';
import { Disclaimer } from '../components/Disclaimer';
import { EmptyState } from '../components/EmptyState';
import { Money } from '../components/ui';
import { isEmptyProfile, useReadyData } from '../state/AppData';

export function FluxoScreen() {
  const { profile, today } = useReadyData();
  if (isEmptyProfile(profile)) return <EmptyState />;

  const lastMonth = addMonths(monthOf(today), 2);
  const events = buildEvents(profile, today).filter((e) => monthOf(e.date) <= lastMonth);
  const rows = cashProjection(profileBalance(profile), events);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row, i) => `${row.date}-${i}`}
      contentContainerStyle={styles.page}
      renderItem={({ item, index }) => (
        <View style={styles.row}>
          <Text style={styles.date}>{item.date.slice(5)}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {events[index].label}
            {events[index].estimated ? ' (estimado)' : ''}
          </Text>
          <Money value={events[index].amount} />
          <Money value={item.balance} style={styles.balance} />
        </View>
      )}
      ListFooterComponent={
        <>
          <Text style={styles.hint}>Saldo projetado após cada movimento. Faturas caem no vencimento, não na compra.</Text>
          <Disclaimer />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#8884' },
  date: { width: 44, fontVariant: ['tabular-nums'] },
  label: { flex: 1 },
  balance: { fontWeight: '600' },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 12 },
});
