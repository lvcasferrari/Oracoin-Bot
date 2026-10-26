import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Account } from '../../engine';
import { removeAccount, saveAccount, setBalanceDate } from '../../db/repos';
import { BankPicker, Button, Chips, FormError, FormScreen, InlineConfirm, MoneyInput, trySave, useBusy } from '../../components/form';
import { useForm } from '../../components/useForm';
import { formatDateBR } from '../../lib/dateInput';
import { newId } from '../../lib/id';
import { parseBRL, toInput } from '../../lib/money';
import type { BancosStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { accountFromDraft, MSG, type AccountDraft } from './mappers';

const KINDS = [
  { value: 'corrente' as const, label: 'Conta corrente' },
  { value: 'poupanca' as const, label: 'Poupança' },
  { value: 'carteira' as const, label: 'Carteira' },
];

export function AccountForm({ initial, onSubmit, submitLabel = 'Salvar' }: {
  initial?: Account; onSubmit: (account: Account) => Promise<void>; submitLabel?: string;
}) {
  const f = useForm<AccountDraft, Account>(
    () => ({ id: initial?.id ?? newId('acc'), bank: initial?.bank ?? '', kind: initial?.kind ?? 'corrente', balance: toInput(initial?.balance) }),
    accountFromDraft,
  );
  return (
    <>
      <BankPicker value={f.draft.bank} onChange={f.set('bank')} error={f.errors.bank} />
      <Chips label="Tipo" options={KINDS} value={f.draft.kind} onChange={f.set('kind')} />
      <MoneyInput label="Saldo hoje" value={f.draft.balance} onChangeText={f.set('balance')} error={f.errors.balance} hint="O que aparece no app do banco agora." />
      <FormError message={f.formError} />
      <Button title={submitLabel} onPress={() => f.submit(onSubmit)} disabled={f.busy} />
    </>
  );
}

export function AccountFormScreen({ route, navigation }: NativeStackScreenProps<BancosStackParamList, 'AccountForm'>) {
  const { db, profile, today, refresh } = useReadyData();
  const initial = profile.accounts.find((a) => a.id === route.params?.id);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <FormScreen>
      <AccountForm
        initial={initial}
        onSubmit={async (account) => {
          await db.transaction(async (tx) => {
            await saveAccount(tx, account);
            // A balance typed today is a balance as of today.
            await setBalanceDate(tx, today);
          });
          await refresh();
          navigation.goBack();
        }}
      />
      {initial &&
        (confirming ? (
          <InlineConfirm
            message={`Apagar a conta ${initial.bank}? Lançamentos ligados a ela continuam, sem conta definida.`}
            confirmLabel="Apagar conta"
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              if (await trySave(() => removeAccount(db, initial.id).then(() => undefined), setError)) {
                await refresh();
                navigation.goBack();
              }
            }}
          />
        ) : (
          <Button title="Apagar conta" kind="secondary" onPress={() => setConfirming(true)} />
        ))}
      <FormError message={error} />
    </FormScreen>
  );
}

/** Updates every balance at once, so all accounts share today's balance date. */
export function BalancesScreen({ navigation }: NativeStackScreenProps<BancosStackParamList, 'Balances'>) {
  const { db, profile, meta, today, refresh } = useReadyData();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(profile.accounts.map((a) => [a.id, toInput(a.balance)])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, run] = useBusy();

  if (profile.accounts.length === 0) {
    return (
      <FormScreen>
        <Text style={styles.body}>Nenhuma conta ainda.</Text>
        <Button title="Adicionar conta" onPress={() => navigation.replace('AccountForm')} />
      </FormScreen>
    );
  }

  const save = () => run(async () => {
    const nextErrors: Record<string, string> = {};
    const parsed = profile.accounts.map((a) => {
      const value = values[a.id]?.trim() === '' ? 0 : parseBRL(values[a.id] ?? '');
      if (value === null) nextErrors[a.id] = MSG.money;
      return { ...a, balance: value ?? a.balance };
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const ok = await trySave(
      () =>
        db.transaction(async (tx) => {
          for (const a of parsed) await saveAccount(tx, a);
          await setBalanceDate(tx, today);
        }),
      setError,
    );
    if (ok) {
      await refresh();
      navigation.goBack();
    }
  });

  return (
    <FormScreen>
      <Text style={styles.hint}>Último saldo informado em {formatDateBR(meta.balanceDate)}. Os saldos de hoje substituem os anteriores.</Text>
      {profile.accounts.map((a) => (
        <MoneyInput
          key={a.id}
          label={`${a.bank} (${KINDS.find((k) => k.value === a.kind)?.label ?? a.kind})`}
          value={values[a.id] ?? ''}
          onChangeText={(text) => setValues((v) => ({ ...v, [a.id]: text }))}
          error={errors[a.id]}
        />
      ))}
      <FormError message={error} />
      <Button title="Salvar saldos de hoje" onPress={save} disabled={busy} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16 },
  hint: { fontSize: 13, opacity: 0.7 },
});
