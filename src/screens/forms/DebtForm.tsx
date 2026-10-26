import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addMonths, debtSchedule, debtSummary, monthOf, type Debt } from '../../engine';
import { removeDebt, saveDebt } from '../../db/repos';
import { Button, Chips, DayInput, FormError, FormScreen, InlineConfirm, Input, MoneyInput, MonthInput, trySave } from '../../components/form';
import { Money } from '../../components/ui';
import { useForm } from '../../components/useForm';
import { formatMonthBR } from '../../lib/dateInput';
import { newId } from '../../lib/id';
import { toInput } from '../../lib/money';
import type { BancosStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { debtFromDraft, type DebtDraft } from './mappers';

const KINDS = [
  { value: 'financiamento' as const, label: 'Financiamento' },
  { value: 'emprestimo' as const, label: 'Empréstimo' },
  { value: 'hipoteca' as const, label: 'Imóvel' },
  { value: 'pix_credito' as const, label: 'Pix no crédito' },
];
const SYSTEMS = [
  { value: 'price' as const, label: 'Parcela fixa (Price)' },
  { value: 'sac' as const, label: 'Parcela decrescente (SAC)' },
];

export function DebtForm({ initial, today, onSubmit }: { initial?: Debt; today: string; onSubmit: (debt: Debt) => Promise<void> }) {
  const f = useForm<DebtDraft, Debt>(
    () => ({
      id: initial?.id ?? newId('debt'),
      name: initial?.name ?? '',
      kind: initial?.kind ?? 'financiamento',
      principal: toInput(initial?.principal),
      ratePct: initial ? toInput(Math.round(initial.monthlyRate * 1e6) / 1e4) : '',
      months: initial ? String(initial.months) : '',
      system: initial?.system ?? 'price',
      startMonth: formatMonthBR(initial?.startMonth ?? addMonths(monthOf(today), 1)),
      dueDay: initial ? String(initial.dueDay) : '',
    }),
    debtFromDraft,
  );
  const preview = debtFromDraft(f.draft);
  const summary = preview.ok ? debtSummary(debtSchedule(preview.value)) : null;

  return (
    <>
      <Input label="Nome" value={f.draft.name} onChangeText={f.set('name')} error={f.errors.name} placeholder="Ex.: Carro" />
      <Chips label="Tipo" options={KINDS} value={f.draft.kind} onChange={f.set('kind')} />
      <MoneyInput label="Quanto ainda falta pagar (saldo devedor)" value={f.draft.principal} onChangeText={f.set('principal')} error={f.errors.principal} />
      <Input label="Juros ao mês (%)" keyboardType="decimal-pad" placeholder="Ex.: 1,49" value={f.draft.ratePct} onChangeText={f.set('ratePct')} error={f.errors.ratePct} hint="Está no contrato ou no app do banco." />
      <Input label="Parcelas que faltam" keyboardType="number-pad" value={f.draft.months} onChangeText={f.set('months')} error={f.errors.months} />
      <Chips label="Sistema" options={SYSTEMS} value={f.draft.system} onChange={f.set('system')} />
      <MonthInput label="Mês da próxima parcela" value={f.draft.startMonth} onChangeText={f.set('startMonth')} error={f.errors.startMonth} />
      <DayInput label="Vence dia" value={f.draft.dueDay} onChangeText={f.set('dueDay')} error={f.errors.dueDay} />
      {summary && (
        <Text style={styles.preview}>
          Próxima parcela: <Money value={summary.firstPayment} />. Juros até o fim: <Money value={summary.totalInterest} /> (estimado).
        </Text>
      )}
      <FormError message={f.formError} />
      <Button title="Salvar" onPress={() => f.submit(onSubmit)} disabled={f.busy} />
    </>
  );
}

export function DebtFormScreen({ route, navigation }: NativeStackScreenProps<BancosStackParamList, 'DebtForm'>) {
  const { db, profile, today, refresh } = useReadyData();
  const initial = profile.debts.find((d) => d.id === route.params?.id);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <FormScreen>
      <DebtForm
        initial={initial}
        today={today}
        onSubmit={async (debt) => {
          await saveDebt(db, debt);
          await refresh();
          navigation.goBack();
        }}
      />
      {initial &&
        (confirming ? (
          <InlineConfirm
            message={`Apagar ${initial.name}? As parcelas dela saem da projeção.`}
            confirmLabel="Apagar"
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              if (await trySave(() => removeDebt(db, initial.id).then(() => undefined), setError)) {
                await refresh();
                navigation.goBack();
              }
            }}
          />
        ) : (
          <Button title="Apagar" kind="secondary" onPress={() => setConfirming(true)} />
        ))}
      <FormError message={error} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  preview: { fontSize: 15 },
});
