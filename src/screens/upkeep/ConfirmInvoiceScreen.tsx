import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dueDate, projectedInvoice } from '../../engine';
import { saveInvoice } from '../../db/repos';
import { Button, FormError, FormScreen, MoneyInput, trySave, useBusy } from '../../components/form';
import { Money } from '../../components/ui';
import { formatDateBR, shortMonth } from '../../lib/dateInput';
import { newId } from '../../lib/id';
import { toInput } from '../../lib/money';
import type { InvoiceRouteParams } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { confirmFromDraft } from './mappers';

export function ConfirmInvoiceScreen({ route, navigation }: NativeStackScreenProps<{ ConfirmInvoice: InvoiceRouteParams }, 'ConfirmInvoice'>) {
  const { db, profile, today, refresh } = useReadyData();
  const { cardId, dueMonth } = route.params;
  const card = profile.cards.find((c) => c.id === cardId);
  const row = profile.invoices.find((i) => i.cardId === cardId && i.dueMonth === dueMonth);
  const estimate = card ? row?.amount ?? projectedInvoice(profile, card, dueMonth, today) : 0;
  const [amount, setAmount] = useState(toInput(estimate));
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [busy, run] = useBusy();

  if (!card) return <FormScreen><Text>Este cartão não existe mais.</Text></FormScreen>;

  const save = () =>
    run(async () => {
      const result = confirmFromDraft(amount, { id: row?.id ?? newId('inv'), cardId, dueMonth, estimatedAtConfirm: estimate });
      if (!result.ok) return setError(result.errors.amount);
      const ok = await trySave(async () => {
        await saveInvoice(db, result.value);
        await refresh();
      }, setFormError);
      if (ok) navigation.goBack();
    });

  return (
    <FormScreen>
      <Text style={styles.title}>
        Fatura {card.bank} {card.name !== card.bank ? card.name : ''} de {shortMonth(dueMonth)}
      </Text>
      <Text style={styles.body}>
        Vence em {formatDateBR(dueDate(card, dueMonth))}. A gente estimava <Money value={estimate} />.
      </Text>
      <MoneyInput label="Valor que veio na fatura" value={amount} onChangeText={(t) => { setAmount(t); setError(undefined); }} error={error} autoFocus />
      <FormError message={formError} />
      <Button title="Confirmar valor" onPress={save} disabled={busy} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 15 },
});
