import { ScrollView, StyleSheet, Text } from 'react-native';
import { commitmentRatio, invoiceAmount } from '../engine/engine';
import { sampleProfile } from '../data/sample';
import { Card } from '../components/ui';

const MONTH = '2026-11';

// Referência do app (não padrão de mercado): comprometimento por faixa.
function band(ratio: number): { label: string; note: string } {
  if (ratio < 0.2) return { label: 'Verde', note: 'Comprometimento baixo' };
  if (ratio < 0.3) return { label: 'Amarelo', note: 'Atenção: regra de 30% da renda' };
  if (ratio < 0.5) return { label: 'Laranja', note: 'Aperta: mais de 30% da renda' };
  return { label: 'Vermelho', note: 'Sinal de alerta: mais de 50% da renda' };
}

export function PlanoScreen() {
  const invoices = sampleProfile.cards.reduce((s, c) => s + invoiceAmount(c, sampleProfile.installments, MONTH), 0);
  const fixed = sampleProfile.outflows.reduce((s, o) => s + o.amount, 0);
  const ratio = commitmentRatio(invoices + fixed, sampleProfile.netIncome);
  const current = band(ratio);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card>
        <Text style={styles.label}>Comprometimento do mês</Text>
        <Text style={styles.big}>{Math.round(ratio * 100)}% da renda</Text>
        <Text style={styles.body}>
          {current.label}: {current.note}
        </Text>
        <Text style={styles.hint}>Faixas são referência do app, não padrão oficial. Parâmetros editáveis.</Text>
      </Card>
      <Text style={styles.footer}>Simulação ilustrativa baseada nos dados que você informou. Não é recomendação de investimento nem de crédito.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  label: { fontSize: 13, opacity: 0.6 },
  big: { fontSize: 30, fontWeight: '600' },
  body: { fontSize: 15 },
  hint: { fontSize: 12, opacity: 0.6 },
  footer: { fontSize: 11, opacity: 0.5, marginTop: 8 },
});
