import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PlanoScreen } from '../screens/PlanoScreen';
import { BridgeFormScreen } from '../screens/plano/BridgeForm';
import { EstrategiasScreen } from '../screens/plano/Estrategias';
import { HistoricoScreen } from '../screens/plano/Historico';
import { QuitacaoScreen } from '../screens/plano/Quitacao';
import { RoteiroScreen } from '../screens/plano/Roteiro';
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
      <Stack.Screen name="Quitacao" component={QuitacaoScreen} options={{ title: 'Quitação' }} />
      <Stack.Screen name="Estrategias" component={EstrategiasScreen} options={{ title: 'Estratégias' }} />
      <Stack.Screen name="Roteiro" component={RoteiroScreen} options={{ title: 'Roteiro' }} />
      <Stack.Screen name="Historico" component={HistoricoScreen} options={{ title: 'Histórico' }} />
      <Stack.Screen name="BridgeForm" component={BridgeFormScreen} options={{ title: 'Crédito ponte', presentation: 'modal' }} />
      <Stack.Screen name="Import" component={ImportScreen} options={{ title: 'Importar planilha' }} />
    </Stack.Navigator>
  );
}
