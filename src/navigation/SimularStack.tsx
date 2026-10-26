import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SimuladorScreen } from '../screens/SimuladorScreen';
import type { SimularStackParamList } from './types';

const Stack = createNativeStackNavigator<SimularStackParamList>();

export function SimularStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SimularHome" component={SimuladorScreen} options={{ title: 'E se…?' }} />
    </Stack.Navigator>
  );
}
