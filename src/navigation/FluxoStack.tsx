import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EntriesScreen } from '../screens/forms/EntriesScreen';
import { EntryFormScreen } from '../screens/forms/EntryForm';
import { FluxoScreen } from '../screens/FluxoScreen';
import type { FluxoStackParamList } from './types';

const Stack = createNativeStackNavigator<FluxoStackParamList>();

export function FluxoStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FluxoHome"
        component={FluxoScreen}
        options={({ navigation }) => ({
          title: 'Fluxo de caixa',
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('Lancamentos')} accessibilityRole="button" hitSlop={14}>
              <Text style={{ fontSize: 16, color: '#2f6f4f' }}>Lançamentos</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="Lancamentos" component={EntriesScreen} options={{ title: 'Lançamentos' }} />
      <Stack.Screen name="EntryForm" component={EntryFormScreen} options={{ title: 'Lançamento', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
