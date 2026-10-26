import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PlanoScreen } from '../screens/PlanoScreen';
import type { PlanoStackParamList } from './types';

const Stack = createNativeStackNavigator<PlanoStackParamList>();

export function PlanoStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PlanoHome" component={PlanoScreen} options={{ title: 'Plano' }} />
    </Stack.Navigator>
  );
}
