import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { setOnboarded } from '../../db/repos';
import { FormScreen } from '../../components/form';
import type { RootStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { RaioX } from './RaioX';
import { CardsStep, FixedStep, IncomeStep, InstallmentsStep } from './steps';

const TITLES = ['Sua renda', 'Seus cartões', 'Parcelas que já existem', 'Contas fixas', 'Raio-X do seu próximo mês'];

/** Five short steps to the first useful view, in under 3 minutes (spec 07). */
export function OnboardingScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Onboarding'>) {
  const { db, today, refresh } = useReadyData();
  const startedAt = useRef(Date.now());
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);
  // Cards created here, with the next-invoice amount typed for each (used for the variable estimate).
  const [cards, setCards] = useState<{ id: string; nextInvoice: number }[]>([]);

  const toRaioX = () => {
    setSeconds((Date.now() - startedAt.current) / 1000);
    setStep(4);
  };

  const finish = async () => {
    await setOnboarded(db, today, seconds);
    await refresh();
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  return (
    <FormScreen>
      <View style={styles.progress} accessibilityLabel={`Passo ${step + 1} de ${TITLES.length}`}>
        {TITLES.map((t, i) => (
          <View key={t} style={[styles.segment, i <= step && styles.segmentDone]} />
        ))}
      </View>
      <Text style={styles.title}>{TITLES[step]}</Text>

      {step === 0 && <IncomeStep onDone={() => setStep(1)} />}
      {step === 1 && (
        <CardsStep
          added={cards}
          onAdded={(card) => setCards((cs) => [...cs.filter((c) => c.id !== card.id), card])}
          onDone={() => setStep(cards.length > 0 ? 2 : 3)}
        />
      )}
      {step === 2 && <InstallmentsStep cards={cards} onDone={() => setStep(3)} />}
      {step === 3 && <FixedStep onDone={toRaioX} />}
      {step === 4 && <RaioX onFinish={finish} />}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#8883' },
  segmentDone: { backgroundColor: '#2f6f4f' },
  title: { fontSize: 24, fontWeight: '600' },
});
