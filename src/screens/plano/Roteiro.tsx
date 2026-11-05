import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dueCalendar, monthEvents, monthlyCost, monthlySummary } from '../../engine';
import { Disclaimer } from '../../components/Disclaimer';
import { DueCalendar } from '../../components/DueCalendar';
import { Button, COLORS } from '../../components/form';
import { Card, Money } from '../../components/ui';
import { shortMonth } from '../../lib/dateInput';
import { formatBRL } from '../../lib/money';
import type { PlanoStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { roteiroPreview } from './preview';

const FIRST = 6;

/** Month by month: what leaves the account (payoffs included) and any bridge credit coming in. */
export function RoteiroScreen({ route }: NativeStackScreenProps<PlanoStackParamList, 'Roteiro'>) {
  const ready = useReadyData();
  const preview = route.params?.preview ? roteiroPreview() : null;
  const profile = preview?.profile ?? ready.profile;
  const { today } = ready;
  const [all, setAll] = useState(false);
  const rows = monthlySummary(profile, today);
  const shown = all ? rows : rows.slice(0, FIRST);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.intro}>{preview ? `Prévia: ${preview.title}. Nada foi gravado ainda.` : 'Seu plano atual, com o que já está no seu controle.'}</Text>
      {shown.map((r) => {
        const credit = monthEvents(profile, r.month, today).filter((e) => e.amount > 0 && e.label === 'Crédito ponte');
        return (
          <Card key={r.month}>
            <View style={styles.head}>
              <Text style={styles.month} accessibilityRole="header">
                {shortMonth(r.month)}
              </Text>
              <Text style={styles.meta}>
                custo <Money value={monthlyCost(r)} style={styles.metaStrong} /> · menor saldo <Money value={r.lowBalance} style={[styles.metaStrong, r.lowBalance < 0 && styles.negative]} />
              </Text>
            </View>
            {credit.map((e, i) => (
              <Text key={`${e.date}-${i}`} style={styles.credit}>
                Entra dia {Number(e.date.slice(8))}: crédito ponte de {formatBRL(e.amount)}
              </Text>
            ))}
            <DueCalendar events={dueCalendar(profile, r.month, today)} />
          </Card>
        );
      })}
      {!all && rows.length > FIRST && <Button title={`Mostrar os outros ${rows.length - FIRST} meses`} kind="secondary" onPress={() => setAll(true)} />}
      <Disclaimer />
    </ScrollView>
  );
}

// Secondary text uses COLORS.placeholder, not opacity (contrast holds on the grey cards).
const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  intro: { fontSize: 14, lineHeight: 20, color: COLORS.placeholder },
  head: { gap: 2, marginBottom: 6 },
  month: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.placeholder },
  metaStrong: { fontSize: 13, fontWeight: '600', color: COLORS.text, fontVariant: ['tabular-nums'] },
  negative: { color: COLORS.danger },
  credit: { fontSize: 15, color: COLORS.primaryText, fontWeight: '500', paddingVertical: 6 },
});
