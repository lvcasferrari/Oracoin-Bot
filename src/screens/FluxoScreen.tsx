import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addMonths, cents, criticalMonth, dailyView, dueCalendar, monthOf, monthlySummary } from '../engine';
import { Disclaimer } from '../components/Disclaimer';
import { DueCalendar } from '../components/DueCalendar';
import { EmptyState } from '../components/EmptyState';
import { announce } from '../components/form';
import { Card, Money, Pill } from '../components/ui';
import { shortMonth } from '../lib/dateInput';
import { isEmptyProfile, useReadyData } from '../state/AppData';

type Mode = 'mes' | 'dia' | 'venc';
const MODES: { value: Mode; label: string }[] = [
  { value: 'mes', label: 'Mês a mês' },
  { value: 'dia', label: 'Dia a dia' },
  { value: 'venc', label: 'Vencimentos' },
];

export function FluxoScreen() {
  const { profile, today } = useReadyData();
  const [mode, setMode] = useState<Mode>('mes');
  const [month, setMonth] = useState(monthOf(today));
  const rows = useMemo(() => monthlySummary(profile, today), [profile, today]);
  if (isEmptyProfile(profile)) return <EmptyState />;

  const critical = criticalMonth(rows);
  const first = rows[0].month;
  const last = rows[rows.length - 1].month;
  const shown = month < first ? first : month > last ? last : month;
  const goTo = (next: string) => {
    setMonth(next);
    announce(shortMonth(next));
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.segment} accessibilityRole="tablist">
        {MODES.map((m) => (
          <Pressable
            key={m.value}
            onPress={() => setMode(m.value)}
            style={[styles.segmentItem, mode === m.value && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m.value }}
          >
            <Text style={[styles.segmentText, mode === m.value && styles.segmentTextActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'mes' &&
        rows.map((r) => {
          const isCritical = critical?.month === r.month;
          return (
            <Pressable
              key={r.month}
              onPress={() => {
                setMonth(r.month);
                setMode('dia');
              }}
              accessibilityRole="button"
              accessibilityHint="Abre o dia a dia deste mês"
            >
              <Card>
                <View style={styles.rowHead}>
                  <Text style={styles.month}>{shortMonth(r.month)}</Text>
                  {isCritical && <Pill tone={r.lowBalance < 0 ? 'risk' : 'warn'}>Mês mais crítico</Pill>}
                </View>
                <Text style={styles.body}>
                  Entra <Money value={r.income} /> · sai <Money value={cents(r.outflows + r.invoices + r.debts)} />
                  {r.estimated ? ' (estimado)' : ''}
                </Text>
                <Text style={styles.body}>
                  Sobra no mês: <Money value={r.margin} style={r.margin < 0 ? styles.negative : undefined} />
                </Text>
                <Text style={styles.body}>
                  Saldo no fim: <Money value={r.endBalance} style={r.endBalance < 0 ? styles.negative : undefined} />
                </Text>
              </Card>
            </Pressable>
          );
        })}

      {mode !== 'mes' && (
        <View style={styles.nav}>
          <Pressable onPress={() => goTo(addMonths(shown, -1))} disabled={shown <= first} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Mês anterior">
            <Text style={[styles.navText, shown <= first && styles.disabled]}>‹</Text>
          </Pressable>
          <Text style={styles.month} accessibilityRole="header">
            {shortMonth(shown)}
          </Text>
          <Pressable onPress={() => goTo(addMonths(shown, 1))} disabled={shown >= last} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Próximo mês">
            <Text style={[styles.navText, shown >= last && styles.disabled]}>›</Text>
          </Pressable>
        </View>
      )}

      {mode === 'dia' && <DailyList month={shown} />}
      {mode === 'venc' && <DueCalendar events={dueCalendar(profile, shown, today)} />}

      <Text style={styles.hint}>Faturas entram no dia do vencimento, não no dia da compra.</Text>
      <Disclaimer />
    </ScrollView>
  );
}

function DailyList({ month }: { month: string }) {
  const { profile, today } = useReadyData();
  const rows = dailyView(profile, month, today);
  if (rows.length === 0) return <Text style={styles.hint}>Nada previsto neste mês depois do último saldo informado.</Text>;
  const low = rows.reduce((min, r) => (r.balance < min.balance ? r : min), rows[0]);
  return (
    <View>
      {rows.map((r, i) => {
        const isLow = r === low;
        return (
          <View key={`${r.date}-${r.refId}-${i}`} style={[styles.dayRow, isLow && styles.dayLow]}>
            <Text style={styles.day}>{r.date.slice(8)}</Text>
            <View style={styles.flex}>
              <Text style={styles.body}>
                {r.label}
                {r.estimated ? ' (estimado)' : ''}
              </Text>
              {isLow && <Text style={styles.lowText}>Dia mais crítico do mês</Text>}
            </View>
            <View style={styles.right}>
              <Money value={r.amount} />
              <Money value={r.balance} style={[styles.balance, r.balance < 0 && styles.negative]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10 },
  segment: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: '#767676', overflow: 'hidden' },
  segmentItem: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  segmentActive: { backgroundColor: '#2f6f4f' },
  segmentText: { fontSize: 14 },
  segmentTextActive: { color: '#fff', fontWeight: '600' },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15 },
  negative: { color: '#b3261e', fontWeight: '600' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  navText: { fontSize: 28 },
  disabled: { opacity: 0.25 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#8884' },
  dayLow: { backgroundColor: 'rgba(255,214,214,0.5)' },
  lowText: { fontSize: 12, fontWeight: '600' },
  day: { minWidth: 28, fontVariant: ['tabular-nums'], opacity: 0.75 },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  balance: { fontWeight: '600' },
  hint: { fontSize: 12, opacity: 0.6 },
});
