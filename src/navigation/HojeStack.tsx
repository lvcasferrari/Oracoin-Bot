import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EntryFormScreen } from '../screens/forms/EntryForm';
import { HojeScreen } from '../screens/HojeScreen';
import { CompleteFixedScreen, CompleteInstallmentsScreen } from '../screens/onboarding/CompleteLater';
import { ConfirmInvoiceScreen } from '../screens/upkeep/ConfirmInvoiceScreen';
import { PayInvoiceScreen } from '../screens/upkeep/PayInvoiceScreen';
import type { HojeStackParamList } from './types';

const Stack = createNativeStackNavigator<HojeStackParamList>();

export function HojeStack() {
  return (
    <Stack.Navigator screenOptions={{ statusBarStyle: 'light' }}>
      <Stack.Screen name="HojeHome" component={HojeScreen} options={{ title: 'Hoje' }} />
      <Stack.Screen name="ConfirmInvoice" component={ConfirmInvoiceScreen} options={{ title: 'Confirmar fatura', presentation: 'modal' }} />
      <Stack.Screen name="CompleteInstallments" component={CompleteInstallmentsScreen} options={{ title: 'Parcelas', presentation: 'modal' }} />
      <Stack.Screen name="CompleteFixed" component={CompleteFixedScreen} options={{ title: 'Contas fixas', presentation: 'modal' }} />
      <Stack.Screen name="EntryForm" component={EntryFormScreen} options={{ title: 'Lançamento', presentation: 'modal' }} />
      <Stack.Screen name="PayInvoice" component={PayInvoiceScreen} options={{ title: 'Pagamento da fatura', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
