import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BancosScreen } from '../screens/BancosScreen';
import { FluxoScreen } from '../screens/FluxoScreen';
import { HojeScreen } from '../screens/HojeScreen';
import { PlanoScreen } from '../screens/PlanoScreen';
import { SimuladorScreen } from '../screens/SimuladorScreen';

const Tab = createBottomTabNavigator();

export function RootTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <Tab.Screen name="Hoje" component={HojeScreen} />
      <Tab.Screen name="Fluxo" component={FluxoScreen} />
      <Tab.Screen name="E se…?" component={SimuladorScreen} />
      <Tab.Screen name="Bancos" component={BancosScreen} />
      <Tab.Screen name="Plano" component={PlanoScreen} />
    </Tab.Navigator>
  );
}
