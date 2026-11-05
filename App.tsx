import { StatusBar } from 'expo-status-bar';
import { DefaultTheme, NavigationContainer, type LinkingOptions, type Theme } from '@react-navigation/native';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Backdrop } from './src/components/Brand';
import { BACKDROP, COLORS, STACK_OPTIONS } from './src/components/theme';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootTabs } from './src/navigation/RootTabs';
import type { RootStackParamList } from './src/navigation/types';
import { initialRoute } from './src/screens/onboarding/logic';
import { OnboardingScreen } from './src/screens/onboarding/OnboardingScreen';
import { AppDataProvider, isEmptyProfile, useReadyData } from './src/state/AppData';
import { DataGate } from './src/state/DataGate';

const Root = createNativeStackNavigator<RootStackParamList>();

// Deep links into the tabs and Plano screens (e.g. alivy://plano/quitacao); the scheme is set in app.json.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['alivy://', 'com.lvcasferrari.lifestrategicplan://'],
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

// Transparent screens so the backdrop shows through every page; headers take the air colour.
const THEME: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: COLORS.primary, background: 'transparent', card: BACKDROP[0], text: COLORS.text, border: COLORS.hairline },
};

// The splash (the symbol on off-white) stays up until the brand faces are loaded.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { profile, meta } = useReadyData();
  return (
    <NavigationContainer linking={linking} theme={THEME}>
      <Root.Navigator screenOptions={STACK_OPTIONS} initialRouteName={initialRoute(meta.onboardedAt, isEmptyProfile(profile))}>
        <Root.Screen name="Tabs" component={RootTabs} options={{ headerShown: false }} />
        <Root.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Seu mês em 1 minuto', presentation: 'modal' }} />
      </Root.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
    SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
  });
  // A font that fails to load falls back to the system face rather than blocking the app.
  const ready = fontsLoaded || fontError !== null;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider style={{ backgroundColor: BACKDROP[0] }}>
      <Backdrop />
      <AppDataProvider>
        <DataGate>
          <RootNavigator />
        </DataGate>
      </AppDataProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
