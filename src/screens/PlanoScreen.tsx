import { ScrollView, StyleSheet, Text } from 'react-native';
import { commitmentRatio, monthOf, param, type Parameter } from '../engine';
import { Disclaimer } from '../components/Disclaimer';
import { EmptyState } from '../components/EmptyState';
import { Card } from '../components/ui';
import { isEmptyProfile, useReadyData } from '../state/AppData';

// Referência do app (não padrão de mercado): comprometimento por faixa.
function band(ratio: number, params: Parameter[], today: string): { label: string; note: string } {
  if (ratio < param(params, 'commitment_band_yellow', today)) return { label: 'Verde', note: 'Comprometimento baixo' };
  if (ratio < param(params, 'commitment_band_orange', today)) return { label: 'Amarelo', note: 'Atenção: perto de 30% da renda' };
  if (ratio < param(params, 'commitment_band_red', today)) return { label: 'Laranja', note: 'Aperta: mais de 30% da renda' };
  return { label: 'Vermelho', note: 'Sinal de alerta: mais de 50% da renda' };
}

export function PlanoScreen() {
  const { profile, today } = useReadyData();
  if (isEmptyProfile(profile)) return <EmptyState />;

  const ratio = commitmentRatio(profile, monthOf(today), today);
  const current = band(ratio, profile.parameters, today);

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
      <Disclaimer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  label: { fontSize: 13, opacity: 0.6 },
  big: { fontSize: 30, fontWeight: '600' },
  body: { fontSize: 15 },
  hint: { fontSize: 12, opacity: 0.6 },
});
