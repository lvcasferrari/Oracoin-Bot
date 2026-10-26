import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Card } from '../../engine';
import { removeCard, saveCard } from '../../db/repos';
import { BankPicker, Button, DayInput, FormError, FormScreen, InlineConfirm, Input, MoneyInput, trySave } from '../../components/form';
import { useForm } from '../../components/useForm';
import { newId } from '../../lib/id';
import { toInput } from '../../lib/money';
import type { BancosStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { cardDeletionImpact, cardFromDraft, type CardDraft } from './mappers';

export function CardForm({ initial, onSubmit, submitLabel = 'Salvar' }: {
  initial?: Card; onSubmit: (card: Card) => Promise<void>; submitLabel?: string;
}) {
  const f = useForm<CardDraft, Card>(
    () => ({
      id: initial?.id ?? newId('card'),
      bank: initial?.bank ?? '',
      name: initial && initial.name !== initial.bank ? initial.name : '',
      closingDay: initial ? String(initial.closingDay) : '',
      dueDay: initial ? String(initial.dueDay) : '',
      limit: toInput(initial?.limit),
      variableEstimate: toInput(initial?.variableEstimate),
      availableInformed: toInput(initial?.availableInformed),
    }),
    cardFromDraft,
  );
  return (
    <>
      <BankPicker value={f.draft.bank} onChange={f.set('bank')} error={f.errors.bank} />
      <Input label="Apelido (opcional)" value={f.draft.name} onChangeText={f.set('name')} placeholder="Ex.: Roxinho" />
      <MoneyInput label="Limite total" value={f.draft.limit} onChangeText={f.set('limit')} error={f.errors.limit} />
      <View style={styles.row}>
        <View style={styles.half}>
          <DayInput label="Fecha dia" value={f.draft.closingDay} onChangeText={f.set('closingDay')} error={f.errors.closingDay} />
        </View>
        <View style={styles.half}>
          <DayInput label="Vence dia" value={f.draft.dueDay} onChangeText={f.set('dueDay')} error={f.errors.dueDay} />
        </View>
      </View>
      <MoneyInput
        label="Gasto médio por mês, fora as parcelas"
        value={f.draft.variableEstimate}
        onChangeText={f.set('variableEstimate')}
        error={f.errors.variableEstimate}
        hint="Estimado. Ajuda a prever as próximas faturas."
      />
      <MoneyInput
        label="Limite disponível hoje (opcional)"
        value={f.draft.availableInformed}
        onChangeText={f.set('availableInformed')}
        error={f.errors.availableInformed}
        hint="Se souber, informe. Sem ele, o app mostra uma estimativa."
      />
      <FormError message={f.formError} />
      <Button title={submitLabel} onPress={() => f.submit(onSubmit)} disabled={f.busy} />
    </>
  );
}

export function CardFormScreen({ route, navigation }: NativeStackScreenProps<BancosStackParamList, 'CardForm'>) {
  const { db, profile, refresh } = useReadyData();
  const initial = profile.cards.find((c) => c.id === route.params?.id);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  const impact = initial ? cardDeletionImpact(profile, initial.id) : null;
  const message = initial && impact
    ? `Apagar ${initial.bank} ${initial.name}? Vão junto ${impact.installments} meses de parcelas e ${impact.invoices} faturas registradas.` +
      (impact.entries > 0 ? ` ${impact.entries} lançamentos pagos neste cartão passam a sair da conta.` : '')
    : '';

  return (
    <FormScreen>
      <CardForm
        initial={initial}
        onSubmit={async (card) => {
          await saveCard(db, card);
          await refresh();
          navigation.goBack();
        }}
      />
      {initial && (
        <>
          {/* navigate, not replace: unsaved card edits stay on the screen underneath. */}
          <Button title="Parcelas futuras" kind="secondary" onPress={() => navigation.navigate('InstallmentsForm', { cardId: initial.id })} />
          {confirming ? (
            <InlineConfirm
              message={message}
              confirmLabel="Apagar cartão"
              onCancel={() => setConfirming(false)}
              onConfirm={async () => {
                if (await trySave(() => removeCard(db, initial.id).then(() => undefined), setError)) {
                  await refresh();
                  navigation.goBack();
                }
              }}
            />
          ) : (
            <Button title="Apagar cartão" kind="secondary" onPress={() => setConfirming(true)} />
          )}
        </>
      )}
      <FormError message={error} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
