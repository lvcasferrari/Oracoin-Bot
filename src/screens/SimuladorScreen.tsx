import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, Pressable } from 'react-native';
import { simulatePurchase, type Verdict } from '../engine';
import { sampleProfile } from '../data/sample';
import { Card, Money, Pill } from '../components/ui';

const TODAY = '2026-11-01';

const labels: Record<Verdict, string> = {
  confortavel: 'Confortável',
  atencao: 'Atenção',
  aperta: 'Aperta o mês',
  risco: 'Risco',
};

export function SimuladorScreen() {
  const [total, setTotal] = useState('3000');
  const [parcelas, setParcelas] = useState('6');
  const [cardId, setCardId] = useState(sampleProfile.cards[0].id);

  const amount = Number(total.replace(',', '.'));
  const n = Math.floor(Number(parcelas));
  const valid = Number.isFinite(amount) && amount > 0 && Number.isInteger(n) && n >= 1;
  const result = valid ? simulatePurchase(sampleProfile, { cardId, total: amount, installments: n }, TODAY) : null;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Posso parcelar isso?</Text>

      <Text style={styles.label}>Valor da compra</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={total} onChangeText={setTotal} />

      <Text style={styles.label}>Parcelas</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={parcelas} onChangeText={setParcelas} />

      <Text style={styles.label}>Cartão</Text>
      <Pressable onPress={() => setCardId(nextCard(cardId))} style={styles.input}>
        <Text>{sampleProfile.cards.find((c) => c.id === cardId)?.bank} (toque para trocar)</Text>
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

      <Text style={styles.footer}>Simulação ilustrativa baseada nos dados que você informou. Não é recomendação de investimento nem de crédito.</Text>
    </ScrollView>
  );
}

function nextCard(current: string): string {
  const ids = sampleProfile.cards.map((c) => c.id);
  return ids[(ids.indexOf(current) + 1) % ids.length];
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  label: { fontSize: 13, opacity: 0.6, marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#8886', borderRadius: 10, padding: 12, fontSize: 16 },
  body: { fontSize: 16 },
  footer: { fontSize: 11, opacity: 0.5, marginTop: 12 },
});
