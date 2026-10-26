import type { Profile } from '../engine';
import type { SqlDriver } from './driver';
import {
  getProfileMeta,
  listAccounts,
  listCards,
  listDebts,
  listEntries,
  listGoals,
  listInstallments,
  listInvoices,
  listParameters,
  saveAccount,
  saveCard,
  saveDebt,
  saveEntry,
  saveGoal,
  saveInstallment,
  saveInvoice,
  setBalanceDate,
} from './repos';

/** Reads the whole repository into the engine's Profile. */
export async function loadProfile(db: SqlDriver): Promise<Profile> {
  const meta = await getProfileMeta(db);
  return {
    balanceDate: meta.balanceDate,
    accounts: await listAccounts(db),
    entries: await listEntries(db),
    cards: await listCards(db),
    installments: await listInstallments(db),
    invoices: await listInvoices(db),
    debts: await listDebts(db),
    goals: await listGoals(db),
    parameters: await listParameters(db),
  };
}

/** Writes every entity of a profile (dev sample loader, imports) in one transaction. Parameters are not touched. */
export async function saveProfile(db: SqlDriver, profile: Profile): Promise<void> {
  await db.transaction(async (tx) => {
    await setBalanceDate(tx, profile.balanceDate);
    for (const a of profile.accounts) await saveAccount(tx, a);
    for (const c of profile.cards) await saveCard(tx, c);
    for (const e of profile.entries) await saveEntry(tx, e);
    for (const i of profile.installments) await saveInstallment(tx, i);
    for (const i of profile.invoices) await saveInvoice(tx, i);
    for (const d of profile.debts) await saveDebt(tx, d);
    for (const g of profile.goals) await saveGoal(tx, g);
  });
}
