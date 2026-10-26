import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Goal } from '../../engine';
import { removeGoal, saveGoal } from '../../db/repos';
import { Button, FormError, FormScreen, InlineConfirm, Input, MoneyInput, MonthInput, trySave } from '../../components/form';
import { useForm } from '../../components/useForm';
import { formatMonthBR } from '../../lib/dateInput';
import { newId } from '../../lib/id';
import { toInput } from '../../lib/money';
import type { PlanoStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { goalFromDraft, type GoalDraft } from '../forms/mappers';

export function GoalFormScreen({ route, navigation }: NativeStackScreenProps<PlanoStackParamList, 'GoalForm'>) {
  const { db, profile, refresh } = useReadyData();
  const initial = profile.goals.find((g) => g.id === route.params?.id);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const f = useForm<GoalDraft, Goal>(
    () => ({
      id: initial?.id ?? newId('goal'),
      name: initial?.name ?? '',
      target: toInput(initial?.target),
      saved: toInput(initial?.saved),
      deadline: initial?.deadline ? formatMonthBR(initial.deadline.slice(0, 7)) : '',
      priority: String(initial?.priority ?? profile.goals.length + 1),
    }),
    goalFromDraft,
  );

  return (
    <FormScreen>
      <Input label="Nome" value={f.draft.name} onChangeText={f.set('name')} error={f.errors.name} placeholder="Ex.: Reserva de emergência" />
      <MoneyInput label="Quanto quer juntar" value={f.draft.target} onChangeText={f.set('target')} error={f.errors.target} />
      <MoneyInput label="Quanto já tem guardado" value={f.draft.saved} onChangeText={f.set('saved')} error={f.errors.saved} />
      <MonthInput label="Prazo (opcional)" value={f.draft.deadline} onChangeText={f.set('deadline')} error={f.errors.deadline} />
      <Input
        label="Prioridade"
        keyboardType="number-pad"
        value={f.draft.priority}
        onChangeText={f.set('priority')}
        error={f.errors.priority}
        hint="1 = recebe a sobra do mês primeiro."
      />
      <FormError message={f.formError} />
      <Button
        title="Salvar meta"
        disabled={f.busy}
        onPress={() =>
          f.submit(async (goal) => {
            await saveGoal(db, goal);
            await refresh();
            navigation.goBack();
          })
        }
      />
      {initial &&
        (confirming ? (
          <InlineConfirm
            message={`Apagar a meta ${initial.name}?`}
            confirmLabel="Apagar meta"
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              if (await trySave(() => removeGoal(db, initial.id).then(() => undefined), setError)) {
                await refresh();
                navigation.goBack();
              }
            }}
          />
        ) : (
          <Button title="Apagar meta" kind="secondary" onPress={() => setConfirming(true)} />
        ))}
      <FormError message={error} />
    </FormScreen>
  );
}
