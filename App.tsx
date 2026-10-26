import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HojeScreen } from './src/screens/HojeScreen';
import { FluxoScreen } from './src/screens/FluxoScreen';
import { SimuladorScreen } from './src/screens/SimuladorScreen';
import { BancosScreen } from './src/screens/BancosScreen';
import { PlanoScreen } from './src/screens/PlanoScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
          <Tab.Screen name="Hoje" component={HojeScreen} />
          <Tab.Screen name="Fluxo" component={FluxoScreen} />
          <Tab.Screen name="E se…?" component={SimuladorScreen} />
          <Tab.Screen name="Bancos" component={BancosScreen} />
          <Tab.Screen name="Plano" component={PlanoScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
