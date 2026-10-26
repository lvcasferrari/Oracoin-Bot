import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PlanoScreen } from '../screens/PlanoScreen';
import { GoalFormScreen } from '../screens/plano/GoalForm';
import { ImportScreen } from '../screens/plano/ImportScreen';
import { ParameterFormScreen } from '../screens/plano/ParameterForm';
import type { PlanoStackParamList } from './types';

const Stack = createNativeStackNavigator<PlanoStackParamList>();

export function PlanoStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PlanoHome" component={PlanoScreen} options={{ title: 'Plano' }} />
      <Stack.Screen name="GoalForm" component={GoalFormScreen} options={{ title: 'Meta', presentation: 'modal' }} />
      <Stack.Screen name="ParameterForm" component={ParameterFormScreen} options={{ title: 'Premissa', presentation: 'modal' }} />
      <Stack.Screen name="Import" component={ImportScreen} options={{ title: 'Importar planilha' }} />
    </Stack.Navigator>
  );
}
