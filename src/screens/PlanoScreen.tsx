import { ScrollView, StyleSheet, Text } from 'react-native';
import { commitmentRatio, monthOf, param, type Parameter } from '../engine';
import { sampleProfile } from '../data/sample';
import { Card } from '../components/ui';

const TODAY = '2026-11-01';

// Referência do app (não padrão de mercado): comprometimento por faixa.
function band(ratio: number, params: Parameter[]): { label: string; note: string } {
  if (ratio < param(params, 'commitment_band_yellow', TODAY)) return { label: 'Verde', note: 'Comprometimento baixo' };
  if (ratio < param(params, 'commitment_band_orange', TODAY)) return { label: 'Amarelo', note: 'Atenção: perto de 30% da renda' };
  if (ratio < param(params, 'commitment_band_red', TODAY)) return { label: 'Laranja', note: 'Aperta: mais de 30% da renda' };
  return { label: 'Vermelho', note: 'Sinal de alerta: mais de 50% da renda' };
}

export function PlanoScreen() {
  const ratio = commitmentRatio(sampleProfile, monthOf(TODAY), TODAY);
  const current = band(ratio, sampleProfile.parameters);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card>
        <Text style={styles.label}>Comprometimento do mês</Text>
        <Text style={styles.big}>{Number.isFinite(ratio) ? `${Math.round(ratio * 100)}% da renda` : 'Sem renda no mês'}</Text>
        <Text style={styles.body}>
          {current.label}: {current.note}
        </Text>
        <Text style={styles.hint}>Faturas e dívidas sobre a renda líquida. Faixas são referência do app, não padrão oficial.</Text>
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
