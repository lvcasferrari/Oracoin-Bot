import { StyleSheet, Text, View } from 'react-native';
import type { Card } from '../../engine';
import { Chips, DateInput, DayInput, Input, MoneyInput, MonthInput } from '../../components/form';
import type { SimDraft, SimType } from './mappers';

const SYSTEMS = [
  { value: 'price', label: 'Parcela fixa (Price)' },
  { value: 'sac', label: 'Parcela decrescente (SAC)' },
];

/** The compact form for one "E se…?" type. Field names match `changeFromDraft`. */
export function SimForm({ type, draft, onChange, errors, cards }: {
  type: SimType; draft: SimDraft; onChange: (field: string, value: string) => void; errors: Record<string, string>; cards: Card[];
}) {
  const field = (name: string) => ({ value: draft[name] ?? '', onChangeText: (v: string) => onChange(name, v), error: errors[name] });
  const cardOptions = cards.map((c) => ({ value: c.id, label: c.name === c.bank ? c.bank : `${c.bank} ${c.name}` }));
  const cardChips = (label: string, withAccount = false) => (
    <Chips
      label={label}
      options={withAccount ? [{ value: '', label: 'Conta' }, ...cardOptions] : cardOptions}
      value={draft.cardId ?? ''}
      onChange={(v) => onChange('cardId', v)}
      error={errors.cardId}
    />
  );

  switch (type) {
    case 'purchase':
      return (
        <>
          {cardChips('Cartão')}
          <MoneyInput label="Valor total da compra" {...field('total')} />
          <Input label="Número de parcelas" keyboardType="number-pad" {...field('installments')} />
          <Input label="Juros ao mês (%)" keyboardType="decimal-pad" hint="Deixe vazio se for sem juros." {...field('ratePct')} />
        </>
      );
    case 'payPartial':
      return (
        <>
          {cardChips('Cartão')}
          <MoneyInput label="Quanto consegue pagar agora" hint="O resto vai para o rotativo e depois para o parcelamento da fatura." {...field('payNow')} />
          <Input label="Em quantas parcelas o restante" keyboardType="number-pad" {...field('months')} />
        </>
      );
    case 'financing':
    case 'mortgage':
      return (
        <>
          <Input label="Nome" {...field('name')} />
          <MoneyInput label={type === 'mortgage' ? 'Valor do imóvel' : 'Valor do bem'} {...field('price')} />
          <MoneyInput label="Entrada" {...field('downPayment')} />
          <Input label="Juros ao mês (%)" keyboardType="decimal-pad" {...field('ratePct')} />
          <Input label="Prazo (meses)" keyboardType="number-pad" {...field('months')} />
          <Chips label="Sistema" options={SYSTEMS} value={draft.system} onChange={(v) => onChange('system', v)} />
          <View style={styles.row}>
            <View style={styles.half}>
              <DayInput label="Vence dia" {...field('dueDay')} />
            </View>
            <View style={styles.half}>
              <MonthInput label="Primeira parcela" {...field('startMonth')} />
            </View>
          </View>
          {type === 'mortgage' && <Input label="Teste: renda menor em (%) durante o prazo" keyboardType="decimal-pad" {...field('stressPct')} />}
        </>
      );
    case 'subscription':
      return (
        <>
          <Input label="Nome (opcional)" {...field('name')} />
          <MoneyInput label="Valor por mês" {...field('amount')} />
          <DayInput label="Dia da cobrança" {...field('day')} />
          {cards.length > 0 && cardChips('Paga como', true)}
        </>
      );
    case 'incomeDrop':
      return (
        <>
          <Input label="Quanto a renda cai (%)" keyboardType="decimal-pad" {...field('pct')} />
          <Input label="Por quantos meses" keyboardType="number-pad" {...field('months')} />
          <MonthInput label="A partir de" {...field('startMonth')} />
        </>
      );
    case 'costUp':
      return (
        <>
          <MoneyInput label="Quanto a mais por mês" {...field('amount')} />
          <MonthInput label="A partir de" {...field('startMonth')} />
        </>
      );
    case 'emergency':
      return (
        <>
          <MoneyInput label="Valor do imprevisto" {...field('amount')} />
          <DateInput label="Quando" {...field('date')} />
        </>
      );
  }
}

export const needsCard = (type: SimType): boolean => type === 'purchase' || type === 'payPartial';

export function NoCardHint() {
  return <Text style={styles.hint}>Cadastre um cartão em Bancos para simular esta situação.</Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  hint: { fontSize: 15, opacity: 0.8 },
});
