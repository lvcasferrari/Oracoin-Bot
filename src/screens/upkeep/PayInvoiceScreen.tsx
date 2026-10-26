import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cents, param, projectedInvoice, suggestActions, worstCase, type Invoice } from '../../engine';
import { saveInvoice } from '../../db/repos';
import { ActionsList } from '../../components/ActionsList';
import { Disclaimer } from '../../components/Disclaimer';
import { Button, Chips, FormError, FormScreen, Input, MoneyInput, trySave } from '../../components/form';
import { useForm } from '../../components/useForm';
import { Card, Money } from '../../components/ui';
import { shortMonth } from '../../lib/dateInput';
import { newId } from '../../lib/id';
import { parseBRL, toInput } from '../../lib/money';
import type { InvoiceRouteParams, TabParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { paymentFromDraft, type PaymentDraft } from './mappers';

const MODES = [
  { value: 'full' as const, label: 'Paguei tudo' },
  { value: 'partial' as const, label: 'Paguei uma parte' },
];

export function PayInvoiceScreen({ route, navigation }: NativeStackScreenProps<{ PayInvoice: InvoiceRouteParams }, 'PayInvoice'>) {
  const { db, profile, today, refresh } = useReadyData();
  const { cardId, dueMonth } = route.params;
  const card = profile.cards.find((c) => c.id === cardId);
  const row = profile.invoices.find((i) => i.cardId === cardId && i.dueMonth === dueMonth);
  const initialAmount = card ? row?.amount ?? projectedInvoice(profile, card, dueMonth, today) : 0;
  const defaultMonths = param(profile.parameters, 'partial_plan_default_months', today);
  const [paidInFull, setPaidInFull] = useState(false);
  const base = { id: row?.id ?? newId('inv'), cardId, dueMonth, estimatedAtConfirm: row?.estimatedAtConfirm ?? (row ? undefined : initialAmount) };
  const f = useForm<PaymentDraft, Invoice>(
    () => ({ invoiceAmount: toInput(initialAmount), mode: 'full', paid: '', months: String(row?.partialPlanMonths ?? defaultMonths) }),
    (d) => paymentFromDraft(d, base),
  );

  if (!card) return <FormScreen><Text>Este cartão não existe mais.</Text></FormScreen>;

  const goToBalances = () => {
    navigation.goBack();
    // initial: false keeps BancosHome under Balances even if the Bancos tab was never opened.
    navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Bancos', { screen: 'Balances', initial: false });
  };

  if (paidInFull) {
    return (
      <FormScreen>
        <Text style={styles.title}>Pagamento registrado.</Text>
        <Text style={styles.body}>Quer atualizar o saldo da conta agora? Assim a previsão para de contar esta fatura.</Text>
        <Button title="Atualizar saldos" onPress={goToBalances} />
        <Button title="Agora não" kind="secondary" onPress={() => navigation.goBack()} />
      </FormScreen>
    );
  }

  const amount = parseBRL(f.draft.invoiceAmount);
  const paid = f.draft.paid.trim() === '' ? 0 : parseBRL(f.draft.paid);
  const months = Number(f.draft.months);
  const preview =
    f.draft.mode === 'partial' && amount !== null && paid !== null && paid < amount && Number.isInteger(months) && months >= 1 && months <= 24
      ? worstCase(cents(amount - paid), months, profile.parameters, today)
      : null;
  // Spec catalog #1 (move the due date) for this card, shown next to the worst case.
  const otherExits = preview ? suggestActions(profile, null, today).filter((a) => a.cardId === cardId && a.id === 1) : [];

  return (
    <FormScreen>
      <Text style={styles.title}>
        Fatura {card.bank} de {shortMonth(dueMonth)}
      </Text>
      <MoneyInput label="Valor da fatura" value={f.draft.invoiceAmount} onChangeText={f.set('invoiceAmount')} error={f.errors.invoiceAmount} />
      <Chips label="Como foi o pagamento" options={MODES} value={f.draft.mode} onChange={f.set('mode')} />
      {f.draft.mode === 'partial' && (
        <>
          <MoneyInput label="Quanto você pagou" value={f.draft.paid} onChangeText={f.set('paid')} error={f.errors.paid} />
          <Input label="Em quantas parcelas o restante" keyboardType="number-pad" value={f.draft.months} onChangeText={f.set('months')} error={f.errors.months} hint="O banco costuma oferecer o parcelamento da fatura." />
        </>
      )}
      {preview && (
        <Card>
          <Text style={styles.strong}>Pior caso estimado: ainda muito caro, mas tem teto.</Text>
          <Text style={styles.body}>
            O restante de <Money value={preview.unpaid} /> pode chegar a <Money value={preview.totalPaid} /> no total, em {preview.payments.length} parcelas de cerca de{' '}
            <Money value={preview.monthlyPayment} />.
          </Text>
          <Text style={styles.body}>
            {preview.capped ? 'O teto legal limita os encargos: ' : 'Mesmo com o teto, '}o total não passa de <Money value={cents(preview.unpaid * (1 + preview.assumptions[2].value))} />.
          </Text>
          <View style={styles.assumptions}>
            <Text style={styles.hint}>Premissas (editáveis em Plano):</Text>
            <Text style={styles.hint}>
              Rotativo {(preview.assumptions[0].value * 100).toFixed(1)}% a.m. · parcelamento {(preview.assumptions[1].value * 100).toFixed(1)}% a.m. · fonte: {preview.assumptions[0].source}
            </Text>
            {preview.notes.map((n) => (
              <Text key={n} style={styles.hint}>
                {n}
              </Text>
            ))}
          </View>
          {otherExits.length > 0 && (
            <>
              <Text style={styles.strong}>Outras saídas</Text>
              <ActionsList actions={otherExits} />
            </>
          )}
          <Disclaimer />
        </Card>
      )}
      <FormError message={f.formError} />
      <Button
        title="Registrar pagamento"
        disabled={f.busy}
        onPress={() =>
          f.submit(async (invoice) => {
            // The day of payment lets the forecast stop counting it once the balance is updated.
            await saveInvoice(db, { ...invoice, paidOn: today });
            await refresh();
            if (invoice.status === 'paga') setPaidInFull(true);
            else navigation.goBack();
          })
        }
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600' },
  strong: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15 },
  hint: { fontSize: 12, opacity: 0.7 },
  assumptions: { gap: 2, marginTop: 4 },
});
