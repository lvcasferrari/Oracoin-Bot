import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HojeScreen } from '../screens/HojeScreen';
import type { HojeStackParamList } from './types';

const Stack = createNativeStackNavigator<HojeStackParamList>();

export function HojeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HojeHome" component={HojeScreen} options={{ title: 'Hoje' }} />
    </Stack.Navigator>
  );
}
