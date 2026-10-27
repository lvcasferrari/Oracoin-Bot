import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HojeScreen } from '../screens/HojeScreen';
import { ConfirmInvoiceScreen } from '../screens/upkeep/ConfirmInvoiceScreen';
import { PayInvoiceScreen } from '../screens/upkeep/PayInvoiceScreen';
import type { HojeStackParamList } from './types';

const Stack = createNativeStackNavigator<HojeStackParamList>();

export function HojeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HojeHome" component={HojeScreen} options={{ title: 'Hoje' }} />
      <Stack.Screen name="ConfirmInvoice" component={ConfirmInvoiceScreen} options={{ title: 'Confirmar fatura', presentation: 'modal' }} />
      <Stack.Screen name="PayInvoice" component={PayInvoiceScreen} options={{ title: 'Pagamento da fatura', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
