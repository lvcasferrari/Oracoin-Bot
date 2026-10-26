import { StyleSheet, Text } from 'react-native';
import { addMonths, commitmentRatio, dailyView, dueCalendar, freeMargin, monthOf, param } from '../../engine';
import { Disclaimer } from '../../components/Disclaimer';
import { DueCalendar } from '../../components/DueCalendar';
import { Button } from '../../components/form';
import { Card, Money, Pill } from '../../components/ui';
import { formatDateBR, shortMonth } from '../../lib/dateInput';
import { useReadyData } from '../../state/AppData';
import { raioXInsight } from './logic';

/** "Raio-X do seu próximo mês": margin, due-date calendar, critical day and one insight (spec 07). */
export function RaioX({ onFinish }: { onFinish: () => void }) {
  const { profile, today } = useReadyData();
  const month = addMonths(monthOf(today), 1);
  const margin = freeMargin(profile, month, today);
  const ratio = commitmentRatio(profile, month, today);
  const days = dailyView(profile, month, today);
  const low = days.reduce<(typeof days)[number] | null>((min, d) => (!min || d.balance < min.balance ? d : min), null);
  const orange = param(profile.parameters, 'commitment_band_orange', today);
  const tone = margin < 0 || (low && low.balance < 0) ? 'risk' : ratio >= orange ? 'warn' : 'ok';
  const verdict = tone === 'risk' ? 'Mês apertado' : tone === 'warn' ? 'Atenção' : 'Mês tranquilo';

  return (
    <>
      <Card>
        <Text style={styles.label}>Margem livre em {shortMonth(month)}</Text>
        <Money value={margin} style={styles.big} />
        <Pill tone={tone}>{verdict}</Pill>
      </Card>
      <Card>
        <Text style={styles.insight}>{raioXInsight(profile, today)}</Text>
      </Card>
      <Card>
        <Text style={styles.label}>Vencimentos de {shortMonth(month)}</Text>
        <DueCalendar events={dueCalendar(profile, month, today)} />
      </Card>
      {low && (
        <Card>
          <Text style={styles.label}>Dia mais crítico</Text>
          <Text style={styles.body}>
            {formatDateBR(low.date)}: saldo projetado de <Money value={low.balance} />
          </Text>
        </Card>
      )}
      <Disclaimer />
      <Button title="Ir para o app" onPress={onFinish} />
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, opacity: 0.6 },
  big: { fontSize: 32, fontWeight: '600' },
  body: { fontSize: 16 },
  insight: { fontSize: 17, lineHeight: 24 },
});
