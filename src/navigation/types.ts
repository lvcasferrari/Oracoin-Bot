import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Entry, ParamKey } from '../engine';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Onboarding: undefined;
};

export type TabParamList = {
  Hoje: NavigatorScreenParams<HojeStackParamList> | undefined;
  Fluxo: NavigatorScreenParams<FluxoStackParamList> | undefined;
  'E se…?': NavigatorScreenParams<SimularStackParamList> | undefined;
  Bancos: NavigatorScreenParams<BancosStackParamList> | undefined;
  Plano: NavigatorScreenParams<PlanoStackParamList> | undefined;
};

/** One card's invoice due in a month. */
export type InvoiceRouteParams = { cardId: string; dueMonth: string };

// One stack per tab; a step edits only its own tab's stack file (plan step 06 rule).
export type HojeStackParamList = {
  HojeHome: undefined;
  ConfirmInvoice: InvoiceRouteParams;
  PayInvoice: InvoiceRouteParams;
  /** "Complete depois": the onboarding steps that moved out of the first run. */
  CompleteInstallments: undefined;
  CompleteFixed: undefined;
  /** Quick add, hosted here so saving returns to Hoje. */
  EntryForm: FluxoStackParamList['EntryForm'];
};

export type FluxoStackParamList = {
  FluxoHome: undefined;
  Lancamentos: undefined;
  /** `once`: a one-off spend dated today (the quick add on Hoje). */
  EntryForm: { id?: string; kind?: Entry['kind']; once?: boolean } | undefined;
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
  PayInvoice: InvoiceRouteParams;
};

export type PlanoStackParamList = {
  PlanoHome: undefined;
  GoalForm: { id?: string } | undefined;
  ParameterForm: { key: ParamKey };
  BridgeForm: { id?: string } | undefined;
  Quitacao: undefined;
  Estrategias: undefined;
  Roteiro: { preview?: boolean } | undefined;
  Historico: undefined;
  Premissas: undefined;
  Pontes: undefined;
  Dados: undefined;
  Import: undefined;
};
