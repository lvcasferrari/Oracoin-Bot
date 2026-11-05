// One-tap answers to the upkeep questions, shared by Hoje and the reminder notifications.
import { paymentId, projectedInvoice, type Invoice, type Profile } from '../../engine';
import type { SqlDriver } from '../../db/driver';
import { saveInvoice, savePayment } from '../../db/repos';
import { newId } from '../../lib/id';

/** The stored invoice row and the value a one-tap answer saves; null when the card is gone. */
function current(profile: Profile, cardId: string, dueMonth: string, today: string) {
  const card = profile.cards.find((c) => c.id === cardId);
  if (!card) return null;
  const row = profile.invoices.find((i) => i.cardId === cardId && i.dueMonth === dueMonth);
  return { row, amount: row?.amount ?? projectedInvoice(profile, card, dueMonth, today) };
}

/** "Sim, veio isso": the invoice is confirmed at the value the app expected. */
export async function confirmAtEstimate(db: SqlDriver, profile: Profile, cardId: string, dueMonth: string, today: string): Promise<boolean> {
  const c = current(profile, cardId, dueMonth, today);
  if (!c) return false;
  const invoice: Invoice = {
    ...c.row,
    id: c.row?.id ?? newId('inv'),
    cardId,
    dueMonth,
    amount: c.amount,
    origin: 'confirmada',
    status: c.row?.status ?? 'fechada',
    estimatedAtConfirm: c.row?.estimatedAtConfirm ?? c.amount,
  };
  await saveInvoice(db, invoice);
  return true;
}

/** "Paguei tudo": same rows as the full payment in PayInvoiceScreen (invoice + Histórico), both or neither. */
export async function markPaidInFull(db: SqlDriver, profile: Profile, cardId: string, dueMonth: string, today: string): Promise<boolean> {
  const c = current(profile, cardId, dueMonth, today);
  if (!c) return false;
  const invoice: Invoice = {
    ...c.row,
    id: c.row?.id ?? newId('inv'),
    cardId,
    dueMonth,
    amount: c.amount,
    origin: 'confirmada',
    status: 'paga',
    paidAmount: c.amount,
    paidOn: today,
    estimatedAtConfirm: c.row?.estimatedAtConfirm ?? (c.row ? undefined : c.amount),
    partialPlanMonths: undefined,
  };
  await db.transaction(async (tx) => {
    await saveInvoice(tx, invoice);
    await savePayment(tx, { id: paymentId('invoice', cardId, dueMonth), refType: 'invoice', refId: cardId, month: dueMonth, paidOn: today, amount: c.amount });
  });
  return true;
}
