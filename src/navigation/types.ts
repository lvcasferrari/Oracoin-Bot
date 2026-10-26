import type { Entry } from '../engine';

export type RootStackParamList = {
  Tabs: undefined;
  Onboarding: undefined;
};

// One stack per tab; a step edits only its own tab's stack file (plan step 06 rule).
export type HojeStackParamList = {
  HojeHome: undefined;
};

export type FluxoStackParamList = {
  FluxoHome: undefined;
  Lancamentos: undefined;
  EntryForm: { id?: string; kind?: Entry['kind'] } | undefined;
};

export type SimularStackParamList = {
  SimularHome: undefined;
};

export type BancosStackParamList = {
  BancosHome: undefined;
  AccountForm: { id?: string } | undefined;
  Balances: undefined;
  CardForm: { id?: string } | undefined;
  InstallmentsForm: { cardId: string };
  DebtForm: { id?: string } | undefined;
};

export type PlanoStackParamList = {
  PlanoHome: undefined;
};
