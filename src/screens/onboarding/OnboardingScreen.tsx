import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { setOnboarded, setReminders } from '../../db/repos';
import { askReminderPermission } from '../../notifications/Reminders';
import { Button, FormError, FormScreen, trySave, useAnnounce, useBusy } from '../../components/form';
import type { RootStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { RaioX } from './RaioX';
import { CardsStep, FixedStep, IncomeStep, InstallmentsStep } from './steps';

const TITLES = ['Sua renda', 'Seus cartões', 'Parcelas que já existem', 'Contas fixas', 'Raio-X do seu próximo mês'];
/** One line per step: why we ask, so every field feels worth typing. */
const WHY = [
  'É daqui que sai o dinheiro do mês. Só o valor líquido e o dia.',
  'As faturas são a maior parte do mês. Uma estimativa da próxima já basta.',
  'Compras parceladas já comprometem os próximos meses. Some por fatura.',
  'Aluguel, luz, escola: o que sai todo mês. Toque num atalho e digite o valor.',
  '',
];
const STEPS = TITLES.length - 1;

/** Five short steps to the first useful view, in under 3 minutes (spec 07). */
export function OnboardingScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Onboarding'>) {
  const { db, today, refresh } = useReadyData();
  // Set once on mount, not during render (render must stay pure).
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  // -1 is the welcome screen: what is coming and how long it takes, before any field.
  const [step, setStep] = useState(-1);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string>();
  const [busy, run] = useBusy();
  // Cards created here, with the next-invoice amount typed for each (used for the variable estimate).
  const [cards, setCards] = useState<{ id: string; nextInvoice: number }[]>([]);
  useAnnounce(step < 0 ? 'Boas-vindas' : step < STEPS ? `Passo ${step + 1} de ${STEPS}: ${TITLES[step]}` : TITLES[step]);

  const toTabs = () => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });

  const toRaioX = () => {
    setSeconds((Date.now() - (startedAt.current ?? Date.now())) / 1000);
    setStep(4);
  };

  const finish = (remind: boolean) =>
    run(async () => {
      // The system prompt comes right after the user asked for reminders, never on first launch.
      const granted = remind && (await askReminderPermission().catch(() => false));
      const saved = await trySave(async () => {
        await setOnboarded(db, today, seconds);
        await setReminders(db, granted);
      }, setError);
      if (!saved) return;
      await refresh();
      toTabs();
    });

  if (step < 0) {
    return (
      <FormScreen>
        <Text style={styles.title} accessibilityRole="header">Vamos montar seu próximo mês</Text>
        <Text style={styles.body}>São 4 passos curtos, uns 3 minutos. No fim você vê quanto sobra (ou falta) e quando.</Text>
        {TITLES.slice(0, STEPS).map((t, i) => (
          <Text key={t} style={styles.body}>{i + 1}. {t}</Text>
        ))}
        <Text style={styles.hint}>Valores aproximados servem. Tudo pode ser ajustado depois, e nada sai deste aparelho.</Text>
        <Button title="Começar" onPress={() => { startedAt.current = Date.now(); setStep(0); }} />
        <Button title="Pular, explorar sem preencher" kind="secondary" onPress={toTabs} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      {step < STEPS && (
        <>
          <View style={styles.progress} accessible accessibilityLabel={`Passo ${step + 1} de ${STEPS}`}>
            {TITLES.slice(0, STEPS).map((t, i) => (
              <View key={t} style={[styles.segment, i <= step && styles.segmentDone]} />
            ))}
          </View>
          <View style={styles.topRow}>
            <Text style={styles.hint}>Passo {step + 1} de {STEPS}</Text>
            {/* A first launch must never be a dead end: the app can be explored and filled in later. */}
            <Pressable onPress={toTabs} disabled={busy} accessibilityRole="button" hitSlop={12} style={styles.later}>
              <Text style={styles.link}>Terminar depois</Text>
            </Pressable>
          </View>
        </>
      )}
      <Text style={styles.title} accessibilityRole="header">
        {TITLES[step]}
      </Text>
      {WHY[step] ? <Text style={styles.body}>{WHY[step]}</Text> : null}

      {step === 0 && <IncomeStep onDone={() => setStep(1)} />}
      {step === 1 && (
        <CardsStep
          added={cards}
          onAdded={(card) => setCards((cs) => [...cs.filter((c) => c.id !== card.id), card])}
          onDone={(count) => setStep(count > 0 ? 2 : 3)}
        />
      )}
      {step === 2 && <InstallmentsStep cards={cards} onDone={() => setStep(3)} />}
      {step === 3 && <FixedStep onDone={toRaioX} />}
      {step === 4 && <RaioX onFinish={finish} busy={busy} />}

      <FormError message={error} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#8883' },
  segmentDone: { backgroundColor: '#5fd4a0' },
  title: { fontSize: 24, fontWeight: '600' },
  body: { fontSize: 15 },
  hint: { fontSize: 13, opacity: 0.7 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  later: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 15, color: '#5fd4a0', fontWeight: '600' },
});
