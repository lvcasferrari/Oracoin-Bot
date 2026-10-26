import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootTabs } from './src/navigation/RootTabs';
import type { RootStackParamList } from './src/navigation/types';
import { initialRoute } from './src/screens/onboarding/logic';
import { OnboardingScreen } from './src/screens/onboarding/OnboardingScreen';
import { AppDataProvider, isEmptyProfile, useReadyData } from './src/state/AppData';
import { DataGate } from './src/state/DataGate';

const Root = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { profile, meta } = useReadyData();
  return (
    <NavigationContainer>
      <Root.Navigator initialRouteName={initialRoute(meta.onboardedAt, isEmptyProfile(profile))}>
        <Root.Screen name="Tabs" component={RootTabs} options={{ headerShown: false }} />
        <Root.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Seu mês em 3 minutos', presentation: 'modal' }} />
      </Root.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <DataGate>
          <RootNavigator />
        </DataGate>
      </AppDataProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
