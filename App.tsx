import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootTabs } from './src/navigation/RootTabs';
import type { RootStackParamList } from './src/navigation/types';
import { OnboardingPlaceholder } from './src/screens/onboarding/OnboardingPlaceholder';
import { AppDataProvider } from './src/state/AppData';
import { DataGate } from './src/state/DataGate';

const Root = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <DataGate>
          <NavigationContainer>
            <Root.Navigator>
              <Root.Screen name="Tabs" component={RootTabs} options={{ headerShown: false }} />
              <Root.Screen name="Onboarding" component={OnboardingPlaceholder} options={{ presentation: 'modal', title: 'Começar' }} />
            </Root.Navigator>
          </NavigationContainer>
        </DataGate>
      </AppDataProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
