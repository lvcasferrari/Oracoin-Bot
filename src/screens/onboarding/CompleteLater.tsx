import { StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FormScreen } from '../../components/form';
import { Text } from '../../components/Text';
import type { HojeStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { nextDueMonth } from './logic';
import { FixedStep, InstallmentsStep } from './steps';

// The two onboarding steps that moved out of the first run, offered later from Hoje.

export function CompleteInstallmentsScreen({ navigation }: NativeStackScreenProps<HojeStackParamList, 'CompleteInstallments'>) {
  const { profile, today } = useReadyData();
  // The next invoice the user typed (or confirmed) lets the variable estimate drop the installments inside it.
  const cards = profile.cards.map((c) => ({
    id: c.id,
    nextInvoice: profile.invoices.find((i) => i.cardId === c.id && i.dueMonth === nextDueMonth(c, today))?.amount ?? c.variableEstimate,
  }));
  return (
    <FormScreen>
      <Text style={styles.body}>Compras parceladas já comprometem os próximos meses. Some as parcelas de cada fatura.</Text>
      <InstallmentsStep cards={cards} onDone={() => navigation.goBack()} standalone />
    </FormScreen>
  );
}

export function CompleteFixedScreen({ navigation }: NativeStackScreenProps<HojeStackParamList, 'CompleteFixed'>) {
  return (
    <FormScreen>
      <Text style={styles.body}>Aluguel, luz, escola: o que sai todo mês. Toque num atalho e digite o valor.</Text>
      <FixedStep onDone={() => navigation.goBack()} doneLabel="Pronto" />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15 },
});
