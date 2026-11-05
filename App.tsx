import { StatusBar } from 'expo-status-bar';
import { DarkTheme, NavigationContainer, type LinkingOptions, type Theme } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { BACKDROP, COLORS } from './src/components/theme';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootTabs } from './src/navigation/RootTabs';
import type { RootStackParamList } from './src/navigation/types';
import { initialRoute } from './src/screens/onboarding/logic';
import { OnboardingScreen } from './src/screens/onboarding/OnboardingScreen';
import { AppDataProvider, isEmptyProfile, useReadyData } from './src/state/AppData';
import { DataGate } from './src/state/DataGate';

const Root = createNativeStackNavigator<RootStackParamList>();

// Deep links into the tabs and Plano screens (e.g. com.lvcasferrari.lifestrategicplan://plano/quitacao); the scheme is the bundle id Expo registers.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['com.lvcasferrari.lifestrategicplan://'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Hoje: { screens: { HojeHome: 'hoje' } },
          Fluxo: { screens: { FluxoHome: 'fluxo' } },
          Bancos: { screens: { BancosHome: 'bancos' } },
          Plano: {
            screens: {
              PlanoHome: 'plano',
              Quitacao: 'plano/quitacao',
              Estrategias: 'plano/estrategias',
              Roteiro: 'plano/roteiro',
              Historico: 'plano/historico',
              Premissas: 'plano/premissas',
              Pontes: 'plano/pontes',
              Dados: 'plano/dados',
            },
          },
        },
      },
    },
  },
};

// Transparent screens so the gradient backdrop shows through every page; headers stay a solid night tone.
const THEME: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: COLORS.primary, background: 'transparent', card: '#061512', text: COLORS.text, border: 'rgba(255,255,255,0.10)' },
};

function RootNavigator() {
  const { profile, meta } = useReadyData();
  return (
    <NavigationContainer linking={linking} theme={THEME}>
      <Root.Navigator screenOptions={{ statusBarStyle: 'light' }} initialRouteName={initialRoute(meta.onboardedAt, isEmptyProfile(profile))}>
        <Root.Screen name="Tabs" component={RootTabs} options={{ headerShown: false }} />
        <Root.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Seu mês em 3 minutos', presentation: 'modal' }} />
      </Root.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={{ backgroundColor: BACKDROP[0] }}>
      <LinearGradient colors={BACKDROP} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <AppDataProvider>
        <DataGate>
          <RootNavigator />
        </DataGate>
      </AppDataProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
