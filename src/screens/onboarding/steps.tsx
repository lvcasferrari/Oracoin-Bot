import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { monthOf, param, type Card, type Category } from '../../engine';
import { replaceCardInstallments, saveAccount, saveCard, saveEntry, saveInvoice, setBalanceDate } from '../../db/repos';
import { BankPicker, Button, Chips, DayInput, FormError, Input, MoneyInput, trySave, useBusy } from '../../components/form';
import { Money } from '../../components/ui';
import { CATEGORY_LABELS } from '../../lib/banks';
import { formatMonthBR } from '../../lib/dateInput';
import { newId } from '../../lib/id';
import { parseBRL } from '../../lib/money';
import { useReadyData } from '../../state/AppData';
import { gridMonths, gridValues, InstallmentsGrid } from '../forms/InstallmentsForm';
import { accountFromDraft, cardFromDraft, entryFromDraft, installmentsFromGrid, MSG } from '../forms/mappers';
import { defaultVariableEstimate, nextDueMonth, onboardingInvoice } from './logic';

const SKIP = 'Pular por agora';

/** Step 1: net income, pay day, and (optionally) today's balance. */
export function IncomeStep({ onDone }: { onDone: () => void }) {
  const { db, today, refresh } = useReadyData();
  const ids = useRef({ entry: newId('entry'), account: newId('acc') });
  const [income, setIncome] = useState('');
  const [day, setDay] = useState('');
  const [bank, setBank] = useState('');
  const [balance, setBalance] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, run] = useBusy();

  const next = () => run(async () => {
    const entry = entryFromDraft({
      id: ids.current.entry, kind: 'in', name: 'Salário', amount: income, recurrence: 'monthly', day, startMonth: formatMonthBR(monthOf(today)), endMonth: '', date: '',
    });
    const account = accountFromDraft({ id: ids.current.account, bank: bank || 'Minha conta', kind: 'corrente', balance });
    const nextErrors = { ...(entry.ok ? {} : entry.errors), ...(account.ok ? {} : account.errors) };
    setErrors(nextErrors);
    if (!entry.ok || !account.ok) return;
    const ok = await trySave(
      () =>
        db.transaction(async (tx) => {
          await saveAccount(tx, account.value);
          await saveEntry(tx, { ...entry.value, accountId: account.value.id });
          await setBalanceDate(tx, today);
        }),
      setError,
    );
    if (ok) {
      await refresh();
      onDone();
    }
  });

  return (
    <>
      <Text style={styles.privacy}>Seus dados ficam só neste aparelho. Nada é enviado para servidores, e você pode apagar tudo em Plano.</Text>
      <MoneyInput label="Quanto cai na conta por mês (líquido)" value={income} onChangeText={setIncome} error={errors.amount} autoFocus />
      <DayInput label="Dia em que cai" value={day} onChangeText={setDay} error={errors.day} />
      <BankPicker value={bank} onChange={setBank} />
      <MoneyInput label="Quanto tem na conta hoje? (opcional)" value={balance} onChangeText={setBalance} error={errors.balance} hint="Sem isso, o app começa do zero." />
      <FormError message={error} />
      <Button title="Continuar" onPress={next} disabled={busy} />
    </>
  );
}

/** Step 2: cards, one at a time, with the next invoice amount (an estimate is fine). */
export function CardsStep({ added, onAdded, onDone }: {
  added: { id: string; nextInvoice: number }[]; onAdded: (card: { id: string; nextInvoice: number }) => void; onDone: () => void;
}) {
  const { db, profile, today, refresh } = useReadyData();
  const empty = { bank: '', limit: '', closingDay: '', dueDay: '', nextInvoice: '' };
  const [draft, setDraft] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const set = (key: keyof typeof empty) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const [busy, run] = useBusy();

  // One add at a time: a double tap must not create the same card twice.
  const add = () => run(async () => {
    const id = newId('card');
    const nextInvoice = draft.nextInvoice.trim() === '' ? 0 : parseBRL(draft.nextInvoice);
    const card = cardFromDraft({ id, bank: draft.bank, name: '', closingDay: draft.closingDay, dueDay: draft.dueDay, limit: draft.limit, variableEstimate: '', availableInformed: '' });
    const nextErrors = { ...(card.ok ? {} : card.errors), ...(nextInvoice === null ? { nextInvoice: MSG.money } : {}) };
    setErrors(nextErrors);
    if (!card.ok || nextInvoice === null) return;
    const withEstimate: Card = { ...card.value, variableEstimate: defaultVariableEstimate(nextInvoice, 0) };
    const ok = await trySave(
      () =>
        db.transaction(async (tx) => {
          await saveCard(tx, withEstimate);
          if (nextInvoice > 0) await saveInvoice(tx, onboardingInvoice(withEstimate, nextInvoice, today, profile.parameters, newId('inv')));
        }),
      setError,
    );
    if (ok) {
      await refresh();
      onAdded({ id, nextInvoice });
      setDraft(empty);
    }
  });

  return (
    <>
      {added.length > 0 && (
        <View style={styles.added}>
          {added.map((a) => {
            const c = profile.cards.find((x) => x.id === a.id);
            return c ? (
              <Text key={a.id} style={styles.body}>
                ✓ {c.bank}: fecha dia {c.closingDay}, vence dia {c.dueDay}
              </Text>
            ) : null;
          })}
        </View>
      )}
      <BankPicker value={draft.bank} onChange={set('bank')} error={errors.bank} />
      <MoneyInput label="Limite total" value={draft.limit} onChangeText={set('limit')} error={errors.limit} />
      <View style={styles.row}>
        <View style={styles.half}>
          <DayInput label="Fecha dia" value={draft.closingDay} onChangeText={set('closingDay')} error={errors.closingDay} />
        </View>
        <View style={styles.half}>
          <DayInput label="Vence dia" value={draft.dueDay} onChangeText={set('dueDay')} error={errors.dueDay} />
        </View>
      </View>
      <MoneyInput label="Quanto vem na próxima fatura? (estimativa serve)" value={draft.nextInvoice} onChangeText={set('nextInvoice')} error={errors.nextInvoice} />
      <FormError message={error} />
      <Button title={added.length > 0 ? 'Adicionar outro cartão' : 'Adicionar cartão'} kind={added.length > 0 ? 'secondary' : 'primary'} onPress={add} disabled={busy} />
      <Button title={added.length > 0 ? 'Continuar' : SKIP} kind={added.length > 0 ? 'primary' : 'secondary'} onPress={onDone} disabled={busy} />
    </>
  );
}

/** Step 3: installments already committed, summed per invoice month. Also settles each card's variable estimate. */
export function InstallmentsStep({ cards, onDone }: { cards: { id: string; nextInvoice: number }[]; onDone: () => void }) {
  const { db, profile, today, refresh } = useReadyData();
  const months = gridMonths(monthOf(today), param(profile.parameters, 'projection_months', today));
  const [selected, setSelected] = useState(cards[0]?.id);
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(cards.map((c) => [c.id, gridValues(profile.installments, c.id, months)])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, run] = useBusy();

  const save = (withGrid: boolean) => run(async () => {
    const rows: Record<string, ReturnType<typeof installmentsFromGrid>> = {};
    for (const c of cards) rows[c.id] = installmentsFromGrid(c.id, withGrid ? values[c.id] ?? {} : {}, () => newId('inst'));
    const failed = Object.entries(rows).find(([, r]) => !r.ok);
    if (failed) {
      setSelected(failed[0]);
      const r = failed[1];
      setErrors(r.ok ? {} : r.errors);
      return;
    }
    const ok = await trySave(
      () =>
        db.transaction(async (tx) => {
          for (const c of cards) {
            const r = rows[c.id];
            if (!r.ok) continue;
            if (withGrid) await replaceCardInstallments(tx, c.id, months[0], r.value);
            const card = profile.cards.find((x) => x.id === c.id);
            if (!card) continue;
            const due = nextDueMonth(card, today);
            const inThatMonth = r.value.filter((i) => i.dueMonth === due).reduce((s, i) => s + i.amount, 0);
            await saveCard(tx, { ...card, variableEstimate: defaultVariableEstimate(c.nextInvoice, inThatMonth) });
          }
        }),
      setError,
    );
    if (ok) {
      await refresh();
      onDone();
    }
  });

  const options = cards.map((c) => {
    const card = profile.cards.find((x) => x.id === c.id);
    return { value: c.id, label: card ? card.bank : c.id };
  });

  return (
    <>
      <Text style={styles.body}>Some as parcelas de cada fatura. Não precisa listar compra por compra.</Text>
      {cards.length > 1 && <Chips label="Cartão" options={options} value={selected} onChange={setSelected} />}
      {selected && (
        <InstallmentsGrid
          months={months}
          values={values[selected] ?? {}}
          onChange={(v) => setValues((all) => ({ ...all, [selected]: v }))}
          errors={errors}
        />
      )}
      <FormError message={error} />
      <Button title="Continuar" onPress={() => save(true)} disabled={busy} />
      <Button title={SKIP} kind="secondary" onPress={() => save(false)} disabled={busy} />
    </>
  );
}

const QUICK: { name: string; category: Category }[] = [
  { name: 'Aluguel', category: 'moradia' },
  { name: 'Condomínio', category: 'moradia' },
  { name: 'Luz', category: 'moradia' },
  { name: 'Internet', category: 'moradia' },
  { name: 'Escola', category: 'outros' },
  { name: 'Mercado', category: 'alimentacao' },
  { name: 'Transporte', category: 'transporte' },
];
const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value: value as Category, label }));

/** Step 4: the main fixed costs, as monthly outflows. */
export function FixedStep({ onDone }: { onDone: () => void }) {
  const { db, profile, today, refresh } = useReadyData();
  const empty = { name: '', amount: '', day: '', category: undefined as Category | undefined };
  const [draft, setDraft] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const added = profile.entries.filter((e) => e.kind === 'out');
  const [busy, run] = useBusy();

  const add = () => run(async () => {
    const entry = entryFromDraft({
      id: newId('entry'), kind: 'out', name: draft.name, amount: draft.amount, recurrence: 'monthly', day: draft.day,
      startMonth: formatMonthBR(monthOf(today)), endMonth: '', date: '', category: draft.category,
    });
    if (!entry.ok) {
      setErrors(entry.errors);
      return;
    }
    setErrors({});
    if (await trySave(() => saveEntry(db, entry.value).then(() => undefined), setError)) {
      await refresh();
      setDraft(empty);
    }
  });

  return (
    <>
      {added.map((e) => (
        <View key={e.id} style={styles.addedRow}>
          <Text style={styles.body}>✓ {e.name}, dia {e.day}</Text>
          <Money value={e.amount} />
        </View>
      ))}
      <Chips
        label="Atalhos"
        options={QUICK.map((q) => ({ value: q.name, label: q.name }))}
        value={QUICK.some((q) => q.name === draft.name) ? draft.name : undefined}
        onChange={(name) => setDraft((d) => ({ ...d, name, category: QUICK.find((q) => q.name === name)?.category }))}
      />
      <Input label="Nome" value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} error={errors.name} />
      <View style={styles.row}>
        <View style={styles.half}>
          <MoneyInput label="Valor por mês" value={draft.amount} onChangeText={(amount) => setDraft((d) => ({ ...d, amount }))} error={errors.amount} />
        </View>
        <View style={styles.half}>
          <DayInput label="Dia" value={draft.day} onChangeText={(day) => setDraft((d) => ({ ...d, day }))} error={errors.day} />
        </View>
      </View>
      <Chips label="Categoria (opcional)" options={CATEGORIES} value={draft.category} onChange={(category) => setDraft((d) => ({ ...d, category }))} />
      <FormError message={error} />
      <Button title="Adicionar" kind="secondary" onPress={add} disabled={busy} />
      <Button title={added.length > 0 ? 'Ver meu Raio-X' : SKIP} onPress={onDone} disabled={busy} />
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15 },
  privacy: { fontSize: 13, opacity: 0.8 },
  added: { gap: 4 },
  addedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
