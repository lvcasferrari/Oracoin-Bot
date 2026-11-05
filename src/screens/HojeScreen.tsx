import { ScrollView, StyleSheet } from 'react-native';
import { Text } from '../components/Text';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { buildEvents, cashProjection, freeMargin, invoicesToConfirm, monthlySummary, monthOf, profileBalance, suggestActions } from '../engine';
import { ActionsList } from '../components/ActionsList';
import { Disclaimer } from '../components/Disclaimer';
import { EmptyState } from '../components/EmptyState';
import { Button, COLORS } from '../components/form';
import { BarChart, Money, Card, Pill, StackBar } from '../components/ui';
import { formatDateBR } from '../lib/dateInput';
import type { HojeStackParamList, TabParamList } from '../navigation/types';
import { isEmptyProfile, useReadyData } from '../state/AppData';

export function HojeScreen({ navigation }: NativeStackScreenProps<HojeStackParamList, 'HojeHome'>) {
  const { profile, today } = useReadyData();
  if (isEmptyProfile(profile)) return <EmptyState />;

  const month = monthOf(today);
  const events = buildEvents(profile, today);
  const points = cashProjection(profileBalance(profile), events);
  const margin = freeMargin(profile, month, today);
  const toConfirm = invoicesToConfirm(profile, today);
  const row = monthlySummary(profile, today)[0];

  // Lowest balance this month, measured on the full projection (balance after each event).
  const monthPoints = points.filter((p) => monthOf(p.date) === month);
  const low = monthPoints.reduce<(typeof points)[number] | null>((min, p) => (!min || p.balance < min.balance ? p : min), null);

  // End-of-day balance per day with movement, for the month chart.
  const byDay = new Map<string, number>();
  for (const p of monthPoints) byDay.set(p.date, p.balance);
  const dayBars = [...byDay].map(([date, value]) => ({ key: date, label: date.slice(8), value, highlight: date === low?.date }));

  // Next unpaid invoice, with the projected balance on that day (alerts always check cash, spec 04).
  const nextIndex = events.findIndex((e) => {
    if (e.source !== 'invoice' || e.date < today) return false;
    const row = profile.invoices.find((i) => i.cardId === e.refId && i.dueMonth === monthOf(e.date));
    return row?.status !== 'paga';
  });
  const next = nextIndex >= 0 ? events[nextIndex] : null;
  const balanceOnDue = next ? points[nextIndex].balance : null;
  // Spec 07: "1 insight e 1 ação sugerida".
  const topAction = suggestActions(profile, null, today)[0];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {toConfirm.map((t) => (
        <Card key={`${t.card.id}-${t.dueMonth}`}>
          <Text style={styles.strong}>Fatura {t.card.bank} fechou</Text>
          <Text style={styles.detail}>
            Estimado <Money value={t.estimate} /> · vence {formatDateBR(t.dueDate)}
          </Text>
          <Button title="Confirmar valor" onPress={() => navigation.navigate('ConfirmInvoice', { cardId: t.card.id, dueMonth: t.dueMonth })} />
        </Card>
      ))}

      <Card>
        <Text style={styles.label}>Margem livre do mês</Text>
        <Money value={margin} style={styles.big} />
        <Pill tone={margin >= 0 ? 'ok' : 'risk'}>{margin >= 0 ? 'Mês no azul' : 'Mês no vermelho'}</Pill>
        {row && (
          // Where the month's money goes; total is the larger of income and spending, so a shortfall shows as an unfilled track.
          <StackBar
            total={Math.max(row.income, row.outflows + row.invoices + row.debts)}
            parts={[
              { key: 'contas', label: 'Contas', value: row.outflows, color: '#e8c36a' },
              { key: 'faturas', label: 'Faturas', value: row.invoices, color: '#6fa8ff' },
              { key: 'dividas', label: 'Dívidas', value: row.debts, color: '#ff9f6e' },
              { key: 'sobra', label: 'Sobra', value: Math.max(0, row.margin), color: '#5fd4a0' },
            ]}
          />
        )}
      </Card>

      <Button
        title="+ Lançar gasto ou entrada"
        kind="secondary"
        onPress={() => navigation.navigate('EntryForm', { kind: 'out', once: true })}
      />

      {next && balanceOnDue !== null && (
        <Card>
          <Text style={styles.label}>Próximo vencimento</Text>
          <Money value={-next.amount} style={styles.amount} />
          <Text style={styles.detail}>
            {next.label} · {formatDateBR(next.date)}
            {next.estimated ? ' · estimado' : ''}
          </Text>
          <Text style={styles.detail}>
            Saldo depois: <Money value={balanceOnDue} style={balanceOnDue < 0 ? styles.negative : styles.detailStrong} />
          </Text>
          {balanceOnDue < 0 && (
            <>
              <Pill tone="risk">O saldo previsto não cobre esta fatura</Pill>
              <Button
                title="Ver opções em E se…?"
                kind="secondary"
                onPress={() => navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('E se…?')}
              />
            </>
          )}
          <Button title="Registrar pagamento" kind="secondary" onPress={() => navigation.navigate('PayInvoice', { cardId: next.refId, dueMonth: monthOf(next.date) })} />
        </Card>
      )}

      {topAction && (
        <Card>
          <Text style={styles.label}>Sugestão</Text>
          <ActionsList actions={[topAction]} />
        </Card>
      )}

      {low && (
        <Card>
          <Text style={styles.label}>Saldo ao longo do mês</Text>
          <BarChart bars={dayBars} />
          <Text style={styles.detail}>
            Mais baixo no dia {low.date.slice(8)}: <Money value={low.balance} style={low.balance < 0 ? styles.negative : styles.detailStrong} />
          </Text>
        </Card>
      )}

      <Disclaimer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  label: { fontSize: 13, color: COLORS.placeholder },
  big: { fontSize: 32, fontWeight: '600', color: COLORS.text, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 24, fontWeight: '600', color: COLORS.text, fontVariant: ['tabular-nums'] },
  strong: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  detail: { fontSize: 14, color: COLORS.placeholder },
  detailStrong: { fontWeight: '600', color: COLORS.text },
  negative: { color: '#ff8a80', fontWeight: '600' },
});
