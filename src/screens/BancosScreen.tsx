import { ScrollView, StyleSheet, Text } from 'react-native';
import { invoiceFor, monthOf } from '../engine';
import { sampleProfile } from '../data/sample';
import { Card, Money } from '../components/ui';

const TODAY = '2026-11-01';

export function BancosScreen() {
  const month = monthOf(TODAY);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {sampleProfile.cards.map((card) => {
        const invoice = invoiceFor(sampleProfile, card, month, TODAY);
        const committed = sampleProfile.installments
          .filter((i) => i.cardId === card.id)
          .reduce((s, i) => s + i.amount, 0);
        return (
          <Card key={card.id}>
            <Text style={styles.bank}>
              {card.bank} · {card.name}
            </Text>
            <Text style={styles.body}>
              Fecha dia {card.closingDay}, vence dia {card.dueDay}
            </Text>
            <Text style={styles.body}>
              Fatura do mês: <Money value={invoice.total} /> {invoice.estimated ? '(estimado)' : '(confirmado)'}
            </Text>
            <Text style={styles.body}>
              Parcelas futuras: <Money value={committed} />
            </Text>
            <Text style={styles.body}>
              Limite: <Money value={card.limit} />
            </Text>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  bank: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15 },
});
