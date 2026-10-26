import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, Pressable } from 'react-native';
import { simulatePurchase, type Verdict } from '../engine';
import { Disclaimer } from '../components/Disclaimer';
import { EmptyState } from '../components/EmptyState';
import { Card, Money, Pill } from '../components/ui';
import { isEmptyProfile, useReadyData } from '../state/AppData';

const labels: Record<Verdict, string> = {
  confortavel: 'Confortável',
  atencao: 'Atenção',
  aperta: 'Aperta o mês',
  risco: 'Risco',
};

export function SimuladorScreen() {
  const { profile, today } = useReadyData();
  const [total, setTotal] = useState('3000');
  const [parcelas, setParcelas] = useState('6');
  const [cardId, setCardId] = useState<string | undefined>(profile.cards[0]?.id);

  if (isEmptyProfile(profile)) return <EmptyState />;
  const card = profile.cards.find((c) => c.id === cardId) ?? profile.cards[0];
  if (!card) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.body}>Cadastre um cartão em Bancos para simular uma compra parcelada.</Text>
      </ScrollView>
    );
  }

  const amount = Number(total.replace(',', '.'));
  const n = Math.floor(Number(parcelas));
  const valid = Number.isFinite(amount) && amount > 0 && Number.isInteger(n) && n >= 1;
  const result = valid ? simulatePurchase(profile, { cardId: card.id, total: amount, installments: n }, today) : null;
  const nextCard = () => {
    const ids = profile.cards.map((c) => c.id);
    setCardId(ids[(ids.indexOf(card.id) + 1) % ids.length]);
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Posso parcelar isso?</Text>

      <Text style={styles.label}>Valor da compra</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={total} onChangeText={setTotal} accessibilityLabel="Valor da compra" />

      <Text style={styles.label}>Parcelas</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={parcelas} onChangeText={setParcelas} accessibilityLabel="Número de parcelas" />

      <Text style={styles.label}>Cartão</Text>
      <Pressable onPress={nextCard} style={styles.input} accessibilityRole="button" accessibilityLabel="Trocar cartão">
        <Text>{card.bank} · {card.name} (toque para trocar)</Text>
      </Pressable>

      {result && (
        <Card>
          <Pill tone={result.verdict === 'confortavel' ? 'ok' : result.verdict === 'atencao' ? 'warn' : 'risk'}>
            {labels[result.verdict]}
          </Pill>
          <Text style={styles.body}>
            Parcela de <Money value={result.monthlyInstallment} /> a partir da fatura de {result.firstMonth.slice(5)}/{result.firstMonth.slice(0, 4)}.
          </Text>
          <Text style={styles.body}>
            Menor saldo projetado: <Money value={result.baselineLow} /> hoje, <Money value={result.scenarioLow} /> com a compra.
          </Text>
          <Text style={styles.body}>Usa {Math.round(result.limitShare * 100)}% do limite do cartão.</Text>
        </Card>
      )}

      <Disclaimer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  label: { fontSize: 13, opacity: 0.6, marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#8886', borderRadius: 10, padding: 12, fontSize: 16, minHeight: 44 },
  body: { fontSize: 16 },
});
