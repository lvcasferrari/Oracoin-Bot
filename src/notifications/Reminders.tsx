import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { Profile } from '../engine';
import { announce } from '../components/form';
import { logError } from '../lib/log';
import type { RootStackParamList } from '../navigation/types';
import { confirmAtEstimate, markPaidInFull } from '../screens/upkeep/quick';
import { useReadyData } from '../state/AppData';
import { planReminders, REMINDER_HOUR } from './plan';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

// shortcut: actions open the app, which then saves; background answers need expo-task-manager (iOS drops
// opensAppToForeground: false responses when the app was killed). Upgrade if testers find the hop annoying.
const CATEGORIES: Record<'confirm' | 'pay', Notifications.NotificationAction[]> = {
  confirm: [
    { identifier: 'confirm-yes', buttonTitle: 'Sim, veio isso', options: { opensAppToForeground: true } },
    { identifier: 'confirm-adjust', buttonTitle: 'Ajustar valor', options: { opensAppToForeground: true } },
  ],
  pay: [
    { identifier: 'pay-full', buttonTitle: 'Paguei tudo', options: { opensAppToForeground: true } },
    { identifier: 'pay-other', buttonTitle: 'Paguei outro valor', options: { opensAppToForeground: true } },
  ],
};

/** Asks the system once; false when the user said no (then only the iPhone Settings can turn it on). */
export async function askReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replaces every scheduled reminder with the current plan (or none when off or not allowed). */
async function sync(profile: Profile, today: string, on: boolean) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!on || !(await Notifications.getPermissionsAsync()).granted) return;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Faturas', importance: AndroidImportance.DEFAULT });
  for (const [id, actions] of Object.entries(CATEGORIES)) await Notifications.setNotificationCategoryAsync(id, actions);
  for (const r of planReminders(profile, today)) {
    const [y, m, d] = r.date.split('-').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { kind: r.kind, cardId: r.cardId, dueMonth: r.dueMonth }, categoryIdentifier: r.kind },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(y, m - 1, d, REMINDER_HOUR) },
    });
  }
}

/**
 * Keeps the scheduled reminders in step with the data and answers the ones the user tapped.
 * Rendered once inside the tabs, so navigation is ready; renders nothing.
 */
export function Reminders() {
  const { db, profile, meta, today, refresh } = useReadyData();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    sync(profile, today, meta.reminders).catch((error: unknown) => logError('[reminders] sync failed', error));
  }, [profile, today, meta.reminders]);

  useEffect(() => {
    if (!response) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handled.current === key) return;
    handled.current = key;
    Notifications.clearLastNotificationResponse();
    const data = response.notification.request.content.data as { kind?: string; cardId?: string; dueMonth?: string } | undefined;
    if (!data?.cardId || !data.dueMonth) return;
    const params = { cardId: data.cardId, dueMonth: data.dueMonth };

    const oneTap = response.actionIdentifier === 'confirm-yes' ? confirmAtEstimate : response.actionIdentifier === 'pay-full' ? markPaidInFull : null;
    if (oneTap) {
      oneTap(db, profile, params.cardId, params.dueMonth, today)
        .then(async (saved) => {
          await refresh();
          navigation.navigate('Tabs', { screen: 'Hoje', params: { screen: 'HojeHome' } });
          if (saved) announce(oneTap === confirmAtEstimate ? 'Fatura confirmada.' : 'Pagamento registrado.');
        })
        .catch((error: unknown) => logError('[reminders] one-tap answer failed', error));
      return;
    }
    // A plain tap or "ajustar / outro valor": open the form, already on the right invoice.
    navigation.navigate('Tabs', { screen: 'Hoje', params: { screen: data.kind === 'pay' ? 'PayInvoice' : 'ConfirmInvoice', params, initial: false } });
  }, [response, db, profile, today, refresh, navigation]);

  return null;
}
