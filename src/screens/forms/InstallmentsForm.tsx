import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addMonths, monthOf, param, type Installment } from '../../engine';
import { replaceCardInstallments } from '../../db/repos';
import { Button, FormError, FormScreen, Input, MoneyInput, trySave } from '../../components/form';
import { shortMonth } from '../../lib/dateInput';
import { fillSameAmount } from '../../lib/fill';
import { newId } from '../../lib/id';
import { toInput } from '../../lib/money';
import type { BancosStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { installmentsFromGrid } from './mappers';

/** Next N invoice months for one card, each with the summed amount of installments already committed. */
export function InstallmentsGrid({ months, values, onChange, errors }: {
  months: string[]; values: Record<string, string>; onChange: (values: Record<string, string>) => void; errors: Record<string, string>;
}) {
  const [fillAmount, setFillAmount] = useState('');
  const [fillCount, setFillCount] = useState('');
  const count = Number(fillCount);
  const canFill = fillAmount.trim() !== '' && Number.isInteger(count) && count >= 1 && count <= months.length;

  return (
    <>
      <View style={styles.fill}>
        <Text style={styles.fillTitle}>Mesmo valor por vários meses</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <MoneyInput label="Valor por mês" value={fillAmount} onChangeText={setFillAmount} />
          </View>
          <View style={styles.half}>
            <Input label="Quantos meses" keyboardType="number-pad" value={fillCount} onChangeText={setFillCount} />
          </View>
        </View>
        <Button title="Preencher" kind="secondary" disabled={!canFill} onPress={() => onChange(fillSameAmount(values, months[0], count, fillAmount))} />
      </View>
      {months.map((m) => (
        <MoneyInput key={m} label={`Fatura de ${shortMonth(m)}`} value={values[m] ?? ''} onChangeText={(text) => onChange({ ...values, [m]: text })} error={errors[m]} />
      ))}
    </>
  );
}

export const gridMonths = (firstMonth: string, n: number): string[] => Array.from({ length: n }, (_, k) => addMonths(firstMonth, k));

export function gridValues(installments: Installment[], cardId: string, months: string[]): Record<string, string> {
  const sums: Record<string, number> = {};
  for (const i of installments) if (i.cardId === cardId) sums[i.dueMonth] = (sums[i.dueMonth] ?? 0) + i.amount;
  return Object.fromEntries(months.map((m) => [m, sums[m] ? toInput(sums[m]) : '']));
}

export function InstallmentsFormScreen({ route, navigation }: NativeStackScreenProps<BancosStackParamList, 'InstallmentsForm'>) {
  const { db, profile, today, refresh } = useReadyData();
  const card = profile.cards.find((c) => c.id === route.params.cardId);
  const months = gridMonths(monthOf(today), param(profile.parameters, 'projection_months', today));
  const [values, setValues] = useState(() => gridValues(profile.installments, route.params.cardId, months));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();

  if (!card) {
    return (
      <FormScreen>
        <Text>Este cartão não existe mais.</Text>
      </FormScreen>
    );
  }

  const save = async () => {
    const result = installmentsFromGrid(card.id, values, () => newId('inst'));
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    const ok = await trySave(() => replaceCardInstallments(db, card.id, months[0], result.value), setError);
    if (ok) {
      await refresh();
      navigation.goBack();
    }
  };

  return (
    <FormScreen>
      <Text style={styles.intro}>
        {card.bank} · {card.name}: some as parcelas de cada fatura. Não precisa listar compra por compra.
      </Text>
      <InstallmentsGrid months={months} values={values} onChange={setValues} errors={errors} />
      <FormError message={error} />
      <Button title="Salvar parcelas" onPress={save} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15 },
  fill: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.1)' },
  fillTitle: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
