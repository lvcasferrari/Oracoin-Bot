import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { paymentHistory, paymentId, type HistoryItem, type Payment } from '../../engine';
import { listPayments, removePayment, savePayment } from '../../db/repos';
import { Button, COLORS, FormError, trySave, useAnnounce, useBusy } from '../../components/form';
import { Card, Money } from '../../components/ui';
import { shortMonth } from '../../lib/dateInput';
import { formatBRL } from '../../lib/money';
import { logError } from '../../lib/log';
import { useReadyData } from '../../state/AppData';

/** What was due each month against what was paid: the spreadsheet's "verde = pago". */
export function HistoricoScreen() {
  const { db, profile, today } = useReadyData();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, run] = useBusy();
  useAnnounce(message);

  const load = useCallback(() => listPayments(db).then(setPayments), [db]);
  useEffect(() => {
    load().catch((e: unknown) => {
      logError('[Histórico] load', e);
      setError('Não consegui abrir o histórico. Nada foi apagado.');
    });
  }, [load]);

  const toggle = (month: string, item: HistoryItem) =>
    run(async () => {
      const id = paymentId(item.refType, item.refId, month);
      const action = item.paid === null ? savePayment(db, { id, refType: item.refType, refId: item.refId, month, paidOn: today, amount: item.due }) : removePayment(db, id);
      if (await trySave(() => action.then(() => undefined), setError)) {
        await load();
        setMessage(item.paid === null ? `${item.label} marcada como paga.` : `${item.label} voltou para em aberto.`);
      }
    });

  if (!payments) return <ScrollView contentContainerStyle={styles.page}>{error ? <FormError message={error} /> : <Text style={styles.note}>Carregando…</Text>}</ScrollView>;
  const months = paymentHistory(profile, payments, today);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.note}>Faturas pagas em Hoje entram aqui sozinhas. Parcelas de dívidas você marca nesta tela.</Text>
      {months.map((m) => (
        <Card key={m.month}>
          <Text style={styles.month} accessibilityRole="header">
            {shortMonth(m.month)}
          </Text>
          <Text style={styles.note}>
            Pago <Money value={m.paid} style={styles.strong} /> de <Money value={m.due} style={styles.strong} /> previsto
          </Text>
          {m.items.length === 0 && <Text style={styles.note}>Nada de faturas ou parcelas neste mês.</Text>}
          {m.items.map((item) => (
            <View key={`${item.refType}-${item.refId}`} style={styles.row} accessible={item.refType === 'invoice'} accessibilityLabel={`${item.label}: ${item.paid === null ? `em aberto, ${formatBRL(item.due)}` : `pago, ${formatBRL(item.paid)}`}`}>
              <View style={styles.rowText}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={item.paid === null ? styles.open : styles.paid}>{item.paid === null ? `Em aberto · ${formatBRL(item.due)}` : `Pago · ${formatBRL(item.paid)}`}</Text>
              </View>
              {item.refType === 'debt' && (
                <Button
                  title={item.paid === null ? 'Marcar paga' : 'Desfazer'}
                  kind="secondary"
                  disabled={busy}
                  accessibilityLabel={item.paid === null ? `Marcar ${item.label} de ${shortMonth(m.month)} como paga` : `Desfazer pagamento de ${item.label}`}
                  onPress={() => toggle(m.month, item)}
                />
              )}
            </View>
          ))}
        </Card>
      ))}
      <FormError message={error} />
    </ScrollView>
  );
}

// Paid uses text plus colour, never colour alone (WCAG 1.4.1).
const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  month: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  note: { fontSize: 13, lineHeight: 18, color: COLORS.placeholder },
  strong: { fontSize: 13, fontWeight: '600', color: COLORS.text, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 15, color: COLORS.text },
  open: { fontSize: 13, color: COLORS.placeholder },
  paid: { fontSize: 13, color: COLORS.primaryText, fontWeight: '600' },
});
