import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { buildEvents, cashProjection, freeMargin, monthlySummary, monthOf, pendingUpkeep, profileBalance, suggestActions } from '../engine';
import { ActionsList } from '../components/ActionsList';
import { Disclaimer } from '../components/Disclaimer';
import { EmptyState } from '../components/EmptyState';
import { announce, Button, COLORS, FormError, trySave, useBusy } from '../components/form';
import { BarChart, Money, Card, ListRow, Pill, StackBar } from '../components/ui';
import { formatDateBR } from '../lib/dateInput';
import type { HojeStackParamList, TabParamList } from '../navigation/types';
import { isEmptyProfile, useReadyData } from '../state/AppData';
import { confirmAtEstimate, markPaidInFull } from './upkeep/quick';
import { setLaterDismissed } from '../db/repos';

export function HojeScreen({ navigation }: NativeStackScreenProps<HojeStackParamList, 'HojeHome'>) {
  const { db, profile, meta, today, refresh } = useReadyData();
  const [busy, run] = useBusy();
  const [error, setError] = useState<string>();
  if (isEmptyProfile(profile)) return <EmptyState />;

  const month = monthOf(today);
  const events = buildEvents(profile, today);
  const points = cashProjection(profileBalance(profile), events);
  const margin = freeMargin(profile, month, today);
  const tasks = pendingUpkeep(profile, today);
  // What the 2-step onboarding left out; asked here until done or dismissed.
  const needsInstallments = profile.cards.length > 0 && profile.installments.length === 0;
  const needsFixed = !profile.entries.some((e) => e.kind === 'out');
  const showLater = !meta.laterDismissed && (needsInstallments || needsFixed);
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
      {tasks.length > 0 && (
        <Card>
          <Text style={styles.label} accessibilityRole="header">Pendências</Text>
          {tasks.map((t) => {
            const name = `Fatura ${t.card.bank}`;
            const answer = (action: typeof confirmAtEstimate, done: string) =>
              run(async () => {
                if (await trySave(async () => { await action(db, profile, t.card.id, t.dueMonth, today); await refresh(); }, setError)) announce(done);
              });
            return (
              <View key={`${t.kind}-${t.card.id}-${t.dueMonth}`} style={styles.task}>
                <Text style={styles.strong}>{t.kind === 'confirm' ? `${name} fechou` : t.dueDate === today ? `${name} vence hoje` : `${name} venceu ${formatDateBR(t.dueDate)}`}</Text>
                <Text style={styles.detail}>
                  {t.kind === 'confirm' ? 'Veio ' : 'Pagou '}
                  <Money value={t.amount} style={styles.detailStrong} />?
                </Text>
                <View style={styles.taskButtons}>
                  {t.kind === 'confirm' ? (
                    <>
                      <View style={styles.flex}><Button title="Sim, veio isso" disabled={busy} onPress={() => answer(confirmAtEstimate, `${name} confirmada.`)} /></View>
                      <View style={styles.flex}><Button title="Ajustar" kind="secondary" disabled={busy} onPress={() => navigation.navigate('ConfirmInvoice', { cardId: t.card.id, dueMonth: t.dueMonth })} /></View>
                    </>
                  ) : (
                    <>
                      <View style={styles.flex}><Button title="Paguei tudo" disabled={busy} onPress={() => answer(markPaidInFull, `${name} paga.`)} /></View>
                      <View style={styles.flex}><Button title="Outro valor" kind="secondary" disabled={busy} onPress={() => navigation.navigate('PayInvoice', { cardId: t.card.id, dueMonth: t.dueMonth })} /></View>
                    </>
                  )}
                </View>
              </View>
            );
          })}
          <FormError message={error} />
          <Text style={styles.detail}>Se não responder, o app segue com o valor estimado e considera a fatura paga no vencimento.</Text>
        </Card>
      )}

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

      {showLater && (
        <Card>
          <Text style={styles.label} accessibilityRole="header">Complete seu mês</Text>
          <Text style={styles.detail}>Quanto mais completo, mais certa a previsão. Leva um minuto cada.</Text>
          {needsInstallments && <ListRow icon="layers-outline" label="Parcelas que já existem" detail="Some por fatura, sem listar compra por compra." onPress={() => navigation.navigate('CompleteInstallments')} />}
          {needsFixed && <ListRow icon="home-outline" label="Contas fixas" detail="Aluguel, luz, escola…" onPress={() => navigation.navigate('CompleteFixed')} />}
          <Button
            title="Agora não"
            kind="secondary"
            disabled={busy}
            onPress={() => run(async () => { if (await trySave(() => setLaterDismissed(db).then(() => undefined), setError)) await refresh(); })}
          />
        </Card>
      )}

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
  task: { gap: 6, paddingVertical: 6 },
  taskButtons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
