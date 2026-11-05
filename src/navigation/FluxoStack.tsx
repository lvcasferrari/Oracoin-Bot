import { STACK_OPTIONS } from '../components/theme';
import { Pressable } from 'react-native';
import { Text } from '../components/Text';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EntriesScreen } from '../screens/forms/EntriesScreen';
import { EntryFormScreen } from '../screens/forms/EntryForm';
import { FluxoScreen } from '../screens/FluxoScreen';
import type { FluxoStackParamList } from './types';

const Stack = createNativeStackNavigator<FluxoStackParamList>();

export function FluxoStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTIONS}>
      <Stack.Screen
        name="FluxoHome"
        component={FluxoScreen}
        options={({ navigation }) => ({
          title: 'Fluxo de caixa',
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('Lancamentos')} accessibilityRole="button" hitSlop={14}>
              <Text style={{ fontSize: 16, color: '#0052FF' }}>Lançamentos</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="Lancamentos" component={EntriesScreen} options={{ title: 'Lançamentos' }} />
      <Stack.Screen name="EntryForm" component={EntryFormScreen} options={{ title: 'Lançamento', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
