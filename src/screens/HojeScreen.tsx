import { ScrollView, StyleSheet, Text } from 'react-native';
import { buildEvents, criticalDay, freeMargin, monthOf, profileBalance } from '../engine';
import { sampleProfile } from '../data/sample';
import { Money, Card, Pill } from '../components/ui';

const TODAY = '2026-11-01';

export function HojeScreen() {
  const month = monthOf(TODAY);
  const events = buildEvents(sampleProfile, TODAY).filter((e) => monthOf(e.date) === month);
  const low = criticalDay(profileBalance(sampleProfile), events);
  const margin = freeMargin(sampleProfile, month, TODAY);
  const nextDue = events.find((e) => e.source === 'invoice');

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card>
        <Text style={styles.label}>Margem livre do mês</Text>
        <Money value={margin} style={styles.big} />
        <Pill tone={margin >= 0 ? 'ok' : 'risk'}>{margin >= 0 ? 'Mês no azul' : 'Mês no vermelho'}</Pill>
      </Card>

      {nextDue && (
        <Card>
          <Text style={styles.label}>Próximo vencimento</Text>
          <Text style={styles.body}>
            {nextDue.label}: dia {nextDue.date.slice(8)}
          </Text>
          <Money value={nextDue.amount} style={styles.body} />
          {nextDue.estimated && <Text style={styles.hint}>Estimado: parcelas previstas mais a média do cartão.</Text>}
        </Card>
      )}

      {low && (
        <Card>
          <Text style={styles.label}>Dia mais crítico do mês</Text>
          <Text style={styles.body}>
            Dia {low.date.slice(8)}: saldo projetado de <Money value={low.balance} />
          </Text>
        </Card>
      )}

      <Text style={styles.footer}>Simulação ilustrativa baseada nos dados que você informou. Não é recomendação de investimento nem de crédito.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  label: { fontSize: 13, opacity: 0.6 },
  big: { fontSize: 32, fontWeight: '600' },
  body: { fontSize: 16 },
  hint: { fontSize: 12, opacity: 0.6 },
  footer: { fontSize: 11, opacity: 0.5, marginTop: 8 },
});
