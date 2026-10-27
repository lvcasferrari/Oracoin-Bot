import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BancosScreen } from '../screens/BancosScreen';
import { AccountFormScreen, BalancesScreen } from '../screens/forms/AccountForm';
import { CardFormScreen } from '../screens/forms/CardForm';
import { DebtFormScreen } from '../screens/forms/DebtForm';
import { InstallmentsFormScreen } from '../screens/forms/InstallmentsForm';
import { PayInvoiceScreen } from '../screens/upkeep/PayInvoiceScreen';
import type { BancosStackParamList } from './types';

const Stack = createNativeStackNavigator<BancosStackParamList>();

export function BancosStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="BancosHome" component={BancosScreen} options={{ title: 'Bancos e cartões' }} />
      <Stack.Screen name="AccountForm" component={AccountFormScreen} options={{ title: 'Conta', presentation: 'modal' }} />
      <Stack.Screen name="Balances" component={BalancesScreen} options={{ title: 'Atualizar saldos', presentation: 'modal' }} />
      <Stack.Screen name="CardForm" component={CardFormScreen} options={{ title: 'Cartão', presentation: 'modal' }} />
      <Stack.Screen name="InstallmentsForm" component={InstallmentsFormScreen} options={{ title: 'Parcelas futuras', presentation: 'modal' }} />
      <Stack.Screen name="DebtForm" component={DebtFormScreen} options={{ title: 'Dívida ou financiamento', presentation: 'modal' }} />
      <Stack.Screen name="PayInvoice" component={PayInvoiceScreen} options={{ title: 'Pagamento da fatura', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
