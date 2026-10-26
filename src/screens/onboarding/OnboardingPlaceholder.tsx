import { StyleSheet, Text, View } from 'react-native';

// Replaced by the real onboarding in step 09.
export function OnboardingPlaceholder() {
  return (
    <View style={styles.page}>
      <Text style={styles.text}>Em breve: seu mês em menos de 3 minutos.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontSize: 16, textAlign: 'center' },
});
