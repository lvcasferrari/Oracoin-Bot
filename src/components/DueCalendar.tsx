import { StyleSheet, Text, View } from 'react-native';
import type { CashEvent } from '../engine';
import { formatBRL } from '../lib/money';
import { Money } from './ui';

/** "dia 5: Itaú R$ 2.100 · dia 12: Nubank R$ 4.800" style list of what leaves the account (spec 03). */
export function DueCalendar({ events }: { events: CashEvent[] }) {
  if (events.length === 0) return <Text style={styles.empty}>Nenhum vencimento neste mês.</Text>;
  return (
    <View style={styles.list}>
      {events.map((e, i) => (
        <View
          key={`${e.date}-${e.refId}-${i}`}
          style={styles.row}
          accessible
          accessibilityLabel={`Dia ${Number(e.date.slice(8))}: ${e.label}, ${formatBRL(-e.amount)}${e.estimated ? ', estimado' : ''}`}
        >
          <Text style={styles.day}>dia {Number(e.date.slice(8))}</Text>
          <Text style={styles.label}>
            {e.label}
            {e.estimated ? ' (estimado)' : ''}
          </Text>
          <Money value={-e.amount} style={styles.amount} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  empty: { fontSize: 14, opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#8884' },
  day: { minWidth: 56, fontVariant: ['tabular-nums'], opacity: 0.75 },
  label: { flex: 1, fontSize: 15 },
  amount: { fontSize: 15, fontWeight: '500' },
});
