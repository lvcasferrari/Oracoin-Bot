import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { COLORS } from '../components/form';
import { BancosStack } from './BancosStack';
import { FluxoStack } from './FluxoStack';
import { HojeStack } from './HojeStack';
import { PlanoStack } from './PlanoStack';
import { SimularStack } from './SimularStack';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

type IconName = ComponentProps<typeof Ionicons>['name'];
// Outline when inactive, filled when active: the state reads from shape as well as colour (WCAG 1.4.1).
const ICONS: Record<keyof TabParamList, [IconName, IconName]> = {
  Hoje: ['today-outline', 'today'],
  Fluxo: ['bar-chart-outline', 'bar-chart'],
  'E se…?': ['git-compare-outline', 'git-compare'],
  Bancos: ['card-outline', 'card'],
  Plano: ['compass-outline', 'compass'],
};

export function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.placeholder,
        // Frosted bar over the backdrop.
        tabBarStyle: { backgroundColor: 'rgba(8,18,20,0.55)', borderTopColor: COLORS.hairline },
        tabBarBackground: () => <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />,
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={ICONS[route.name][focused ? 1 : 0]} color={color} size={size} />,
      })}
    >
      <Tab.Screen name="Hoje" component={HojeStack} />
      <Tab.Screen name="Fluxo" component={FluxoStack} />
      <Tab.Screen name="E se…?" component={SimularStack} />
      <Tab.Screen name="Bancos" component={BancosStack} />
      <Tab.Screen name="Plano" component={PlanoStack} />
    </Tab.Navigator>
  );
}
