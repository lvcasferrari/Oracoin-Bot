import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '../../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addMonths, debtSchedule, debtSummary, monthOf, type Debt } from '../../engine';
import { removeDebt, saveDebt } from '../../db/repos';
import { Button, Chips, DateInput, DayInput, FormError, FormScreen, InlineConfirm, Input, MoneyInput, MonthInput, More, trySave } from '../../components/form';
import { Money } from '../../components/ui';
import { useForm } from '../../components/useForm';
import { formatDateBR, formatMonthBR } from '../../lib/dateInput';
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
const PAYOFFABLE = [
  { value: 'sim' as const, label: 'Sim' },
  { value: 'nao' as const, label: 'Não' },
];
const QUOTES = [
  { value: 'none' as const, label: 'Ainda não' },
  { value: 'valor' as const, label: 'Valor para quitar' },
  { value: 'desconto' as const, label: 'Desconto ao ano' },
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
      installment: '',
      system: initial?.system ?? 'price',
      startMonth: formatMonthBR(initial?.startMonth ?? addMonths(monthOf(today), 1)),
      dueDay: initial ? String(initial.dueDay) : '',
      payoffable: initial?.payoffable === false ? 'nao' : 'sim',
      quoteKind: initial?.payoffAmount !== undefined ? 'valor' : initial?.payoffDiscountAnnual !== undefined ? 'desconto' : 'none',
      payoffAmount: toInput(initial?.payoffAmount),
      discountPct: initial?.payoffDiscountAnnual !== undefined ? toInput(Math.round(initial.payoffDiscountAnnual * 1e6) / 1e4) : '',
      quotedOn: initial?.payoffQuotedOn ? formatDateBR(initial.payoffQuotedOn) : '',
    }),
    debtFromDraft,
  );
  const preview = debtFromDraft(f.draft);
  const summary = preview.ok ? debtSummary(debtSchedule(preview.value)) : null;

  return (
    <>
      <Input label="Nome" value={f.draft.name} onChangeText={f.set('name')} error={f.errors.name} placeholder="Ex.: Carro" />
      <Chips label="Tipo" options={KINDS} value={f.draft.kind} onChange={f.set('kind')} />
      <MoneyInput label="Quanto ainda falta pagar (saldo devedor)" value={f.draft.principal} onChangeText={f.set('principal')} error={f.errors.principal} hint="Está no app do banco." />
      {f.draft.ratePct.trim() === '' && (
        <MoneyInput label="Valor da parcela" value={f.draft.installment} onChangeText={f.set('installment')} error={f.errors.installment ?? f.errors.ratePct} hint="Com a parcela, o app calcula os juros para você." />
      )}
      <Input label="Parcelas que faltam" keyboardType="number-pad" value={f.draft.months} onChangeText={f.set('months')} error={f.errors.months} />
      <DayInput label="Vence dia" value={f.draft.dueDay} onChangeText={f.set('dueDay')} error={f.errors.dueDay} />
      <More open={!!initial || !!(f.errors.startMonth || f.errors.payoffAmount || f.errors.discountPct || f.errors.quotedOn)}>
        <Input label="Juros ao mês (%) (opcional)" keyboardType="decimal-pad" placeholder="Ex.: 1,49" value={f.draft.ratePct} onChangeText={f.set('ratePct')} error={f.draft.ratePct.trim() === '' ? undefined : f.errors.ratePct} hint="Se souber, vale mais que a parcela." />
        <Chips label="Sistema" options={SYSTEMS} value={f.draft.system} onChange={f.set('system')} />
        <MonthInput label="Mês da próxima parcela" value={f.draft.startMonth} onChangeText={f.set('startMonth')} error={f.errors.startMonth} />
        <Chips label="O contrato deixa quitar antes?" options={PAYOFFABLE} value={f.draft.payoffable} onChange={f.set('payoffable')} />
        {f.draft.payoffable === 'sim' && (
          <>
            <Chips label="O credor já informou quanto custa quitar?" options={QUOTES} value={f.draft.quoteKind} onChange={f.set('quoteKind')} />
            {f.draft.quoteKind === 'valor' && (
              <MoneyInput label="Valor para quitar hoje" value={f.draft.payoffAmount} onChangeText={f.set('payoffAmount')} error={f.errors.payoffAmount} hint="O valor do boleto de quitação, no app do banco." />
            )}
            {f.draft.quoteKind === 'desconto' && (
              <Input label="Desconto ao ano (%)" keyboardType="decimal-pad" placeholder="Ex.: 5,5" value={f.draft.discountPct} onChangeText={f.set('discountPct')} error={f.errors.discountPct} hint="A taxa usada para descontar as parcelas que faltam." />
            )}
            {f.draft.quoteKind !== 'none' && <DateInput label="Cotado em (opcional)" value={f.draft.quotedOn} onChangeText={f.set('quotedOn')} error={f.errors.quotedOn} />}
          </>
        )}
      </More>
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
          // Keep fields this form does not edit (payoff quote, paid-off month).
          await saveDebt(db, { ...initial, ...debt });
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
