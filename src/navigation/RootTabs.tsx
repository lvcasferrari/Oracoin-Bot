import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BancosStack } from './BancosStack';
import { FluxoStack } from './FluxoStack';
import { HojeStack } from './HojeStack';
import { PlanoStack } from './PlanoStack';
import { SimularStack } from './SimularStack';

const Tab = createBottomTabNavigator();

export function RootTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Hoje" component={HojeStack} />
      <Tab.Screen name="Fluxo" component={FluxoStack} />
      <Tab.Screen name="E se…?" component={SimularStack} />
      <Tab.Screen name="Bancos" component={BancosStack} />
      <Tab.Screen name="Plano" component={PlanoStack} />
    </Tab.Navigator>
  );
}
