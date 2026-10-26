import { ScrollView, StyleSheet, Text } from 'react-native';
import { invoiceFor, monthOf } from '../engine';
import { EmptyState } from '../components/EmptyState';
import { Card, Money } from '../components/ui';
import { isEmptyProfile, useReadyData } from '../state/AppData';

export function BancosScreen() {
  const { profile, today } = useReadyData();
  if (isEmptyProfile(profile)) return <EmptyState />;
  const month = monthOf(today);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {profile.cards.map((card) => {
        const invoice = invoiceFor(profile, card, month, today);
        const committed = profile.installments.filter((i) => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
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
