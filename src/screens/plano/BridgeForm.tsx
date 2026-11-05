import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { param, type Bridge } from '../../engine';
import { removeBridge, saveBridge } from '../../db/repos';
import { Button, Chips, COLORS, FormError, FormScreen, InlineConfirm, Input, MoneyInput, trySave } from '../../components/form';
import { useForm } from '../../components/useForm';
import { newId } from '../../lib/id';
import type { PlanoStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { bridgeFromDraft, type BridgeDraft } from '../forms/mappers';

const KINDS = [
  { value: 'emprestimo' as const, label: 'Crédito que você cotou' },
  { value: 'meta' as const, label: 'Taxa meta' },
  { value: 'parcelar_fatura' as const, label: 'Parcelamento da fatura' },
];
const HINTS: Record<Bridge['kind'], string> = {
  emprestimo: 'Uma proposta que você já recebeu. Com o valor que cai na conta e a parcela, o app calcula a taxa real (com IOF e tarifas).',
  meta: 'A taxa que você espera conseguir. É meta, não oferta: nunca aparece em primeiro lugar nem entra na leitura das dívidas.',
  parcelar_fatura: 'Usa os juros do parcelamento da fatura das premissas, no pior caso, e cobre no máximo a fatura do mês.',
};

export function BridgeFormScreen({ route, navigation }: NativeStackScreenProps<PlanoStackParamList, 'BridgeForm'>) {
  const { db, profile, bridges, today, refresh } = useReadyData();
  const initial = bridges.find((b) => b.id === route.params?.id);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const invoiceRate = param(profile.parameters, 'parcelado_fatura_monthly_rate', today);
  const f = useForm<BridgeDraft, Bridge>(
    () => ({
      id: initial?.id ?? newId('bridge'),
      name: initial?.name ?? '',
      kind: initial?.kind ?? 'emprestimo',
      ratePct: initial && initial.kind !== 'parcelar_fatura' ? String(Math.round(initial.monthlyRate * 1e6) / 1e4).replace('.', ',') : '',
      months: String(initial?.months ?? 12),
      source: initial?.source ?? '',
      effectiveFrom: initial?.effectiveFrom ?? today,
      netReceived: '',
      installment: '',
    }),
    (d) => bridgeFromDraft(d, invoiceRate),
  );

  return (
    <FormScreen>
      <Input label="Nome" value={f.draft.name} onChangeText={f.set('name')} error={f.errors.name} placeholder="Ex.: Proposta do banco" />
      <Chips label="Tipo" options={KINDS} value={f.draft.kind} onChange={f.set('kind')} />
      <Text style={styles.about}>{HINTS[f.draft.kind]}</Text>
      {f.draft.kind !== 'parcelar_fatura' && (
        <>
          <Input label="Juros ao mês (%)" keyboardType="decimal-pad" placeholder="Ex.: 2,5" value={f.draft.ratePct} onChangeText={f.set('ratePct')} error={f.errors.ratePct} />
          {f.draft.kind === 'emprestimo' && (
            <>
              <MoneyInput label="Valor que cai na conta (opcional)" value={f.draft.netReceived} onChangeText={f.set('netReceived')} error={f.errors.netReceived} />
              <MoneyInput label="Parcela (opcional)" value={f.draft.installment} onChangeText={f.set('installment')} error={f.errors.installment} hint="Com os dois, a taxa real substitui a informada acima." />
            </>
          )}
        </>
      )}
      <Input label="Prazo (meses)" keyboardType="number-pad" value={f.draft.months} onChangeText={f.set('months')} error={f.errors.months} />
      <Input label="Fonte (opcional)" value={f.draft.source} onChangeText={f.set('source')} placeholder="Ex.: simulação no app do banco" />
      <FormError message={f.formError} />
      <Button
        title="Salvar opção"
        disabled={f.busy}
        onPress={() =>
          f.submit(async (bridge) => {
            await saveBridge(db, bridge);
            await refresh();
            navigation.goBack();
          })
        }
      />
      {initial &&
        (confirming ? (
          <InlineConfirm
            message={`Apagar a opção ${initial.name}?`}
            confirmLabel="Apagar opção"
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              if (await trySave(() => removeBridge(db, initial.id).then(() => undefined), setError)) {
                await refresh();
                navigation.goBack();
              }
            }}
          />
        ) : (
          <Button title="Apagar opção" kind="secondary" onPress={() => setConfirming(true)} />
        ))}
      <FormError message={error} />
    </FormScreen>
  );
}

// COLORS.placeholder is AA on white and on cards (WCAG 1.4.3), no opacity.
const styles = StyleSheet.create({
  about: { fontSize: 14, color: COLORS.placeholder, marginBottom: 12 },
});
