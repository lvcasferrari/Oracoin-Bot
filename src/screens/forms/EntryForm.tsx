import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { monthOf, type Card, type Category, type Entry } from '../../engine';
import { removeEntry, saveEntry } from '../../db/repos';
import { Button, Chips, DateInput, DayInput, FormError, FormScreen, InlineConfirm, Input, MoneyInput, MonthInput, trySave } from '../../components/form';
import { useForm } from '../../components/useForm';
import { CATEGORY_LABELS } from '../../lib/banks';
import { formatDateBR, formatMonthBR } from '../../lib/dateInput';
import { newId } from '../../lib/id';
import { toInput } from '../../lib/money';
import type { FluxoStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { entryFromDraft, type EntryDraft } from './mappers';

const KINDS = [
  { value: 'in' as const, label: 'Entrada' },
  { value: 'out' as const, label: 'Saída' },
];
const RECURRENCES = [
  { value: 'monthly' as const, label: 'Todo mês' },
  { value: 'once' as const, label: 'Uma vez' },
  { value: 'yearly' as const, label: 'Todo ano' },
];
const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value: value as Category, label }));
const ACCOUNT = '__conta__';

export function EntryForm({ initial, defaultKind = 'out', today, cards, onSubmit, submitLabel = 'Salvar' }: {
  initial?: Entry; defaultKind?: Entry['kind']; today: string; cards: Card[]; onSubmit: (entry: Entry) => Promise<void>; submitLabel?: string;
}) {
  const f = useForm<EntryDraft, Entry>(
    () => ({
      id: initial?.id ?? newId('entry'),
      kind: initial?.kind ?? defaultKind,
      name: initial?.name ?? '',
      amount: toInput(initial?.amount),
      recurrence: initial?.recurrence ?? 'monthly',
      day: initial ? String(initial.day) : '',
      startMonth: formatMonthBR(initial?.startMonth ?? monthOf(today)),
      endMonth: initial?.endMonth ? formatMonthBR(initial.endMonth) : '',
      date: initial?.date ? formatDateBR(initial.date) : '',
      cardId: initial?.cardId,
      category: initial?.category,
      accountId: initial?.accountId,
    }),
    entryFromDraft,
  );
  const cardOptions = [{ value: ACCOUNT, label: 'Conta' }, ...cards.map((c) => ({ value: c.id, label: `${c.bank} ${c.name === c.bank ? '' : c.name}`.trim() }))];

  return (
    <>
      <Chips label="É uma" options={KINDS} value={f.draft.kind} onChange={f.set('kind')} />
      <Input label="Nome" value={f.draft.name} onChangeText={f.set('name')} error={f.errors.name} placeholder={f.draft.kind === 'in' ? 'Ex.: Salário' : 'Ex.: Aluguel'} />
      <MoneyInput label="Valor" value={f.draft.amount} onChangeText={f.set('amount')} error={f.errors.amount} />
      <Chips label="Repete" options={RECURRENCES} value={f.draft.recurrence} onChange={f.set('recurrence')} />
      {f.draft.recurrence === 'once' ? (
        <DateInput label="Data" value={f.draft.date} onChangeText={f.set('date')} error={f.errors.date} />
      ) : (
        <>
          <DayInput label="Dia do mês" value={f.draft.day} onChangeText={f.set('day')} error={f.errors.day} hint="Em meses mais curtos, conta o último dia." />
          <MonthInput label={f.draft.recurrence === 'yearly' ? 'Mês (e ano de início)' : 'Começa em'} value={f.draft.startMonth} onChangeText={f.set('startMonth')} error={f.errors.startMonth} />
          <MonthInput label="Termina em (opcional)" value={f.draft.endMonth} onChangeText={f.set('endMonth')} error={f.errors.endMonth} />
        </>
      )}
      {f.draft.kind === 'out' && (
        <>
          {cards.length > 0 && (
            <Chips
              label="Sai de onde"
              options={cardOptions}
              value={f.draft.cardId ?? ACCOUNT}
              onChange={(v) => f.set('cardId')(v === ACCOUNT ? undefined : v)}
            />
          )}
          <Chips label="Categoria (opcional)" options={CATEGORIES} value={f.draft.category} onChange={f.set('category')} />
        </>
      )}
      <FormError message={f.formError} />
      <Button title={submitLabel} onPress={() => f.submit(onSubmit)} disabled={f.busy} />
    </>
  );
}

export function EntryFormScreen({ route, navigation }: NativeStackScreenProps<FluxoStackParamList, 'EntryForm'>) {
  const { db, profile, today, refresh } = useReadyData();
  const initial = profile.entries.find((e) => e.id === route.params?.id);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <FormScreen>
      <EntryForm
        initial={initial}
        defaultKind={route.params?.kind}
        today={today}
        cards={profile.cards}
        onSubmit={async (entry) => {
          await saveEntry(db, entry);
          await refresh();
          navigation.goBack();
        }}
      />
      {initial &&
        (confirming ? (
          <InlineConfirm
            message={`Apagar ${initial.name}?`}
            confirmLabel="Apagar"
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              if (await trySave(() => removeEntry(db, initial.id).then(() => undefined), setError)) {
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
