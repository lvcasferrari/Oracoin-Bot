# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

Ships on iOS and Android from one React Native (Expo) codebase with one shared look; it does not adapt its design language per OS.

## Users

Brazilian adults whose month revolves around credit cards, instalments and debts, aimed at the general public from day one (including people new to budgeting). The job: see whether the month closes, avoid the rotativo, and plan how to pay debts off, from consolidated values they type (an invoice total and its due date), not individual purchases.

## Product Purpose

Life Strategic Plan is a cash-flow simulator that predicts the coming months invoice by invoice and says, in calm language, what each decision would do. It is also the repository of the user's money: income, outflows, invoices by bank and due date, debts and goals. The simulator never has separate data; it always starts from the repository. Success: the user knows the critical day, the monthly cost and the effect of a decision before making it.

## Positioning

The card is the centre: in Brazil the budget breaks on the card, not on income. The app models invoices by closing and due day, the rotativo worst case, and (in the payoff module) payoff return, bridge credit and strategy comparison, always from the user's own figures.

## Operating Context

Born from a personal spreadsheet called "Life Strategic Plan" and the "Plano de Quitação" study. Data stays on the device (SQLite). Users can import a spreadsheet model. Every rate is a dated parameter with a visible source that the user can edit.

## Capabilities and Constraints

- pt-BR only, BRL money, dates dd/mm/aaaa.
- No investment advice and no credit offers (CVM/BCB guardrails): the fixed disclaimer "Simulação ilustrativa baseada nos dados que você informou. Não é recomendação de investimento nem de crédito." appears on result screens; a banned-words list in `src/lib/copy.ts` is enforced by tests.
- The app compares only options the user informed; a target ("meta") rate is labelled "meta, não oferta" and never ranks first.
- Dark mode is the default and only theme: a "liquid glass" look (frosted cards on a teal-to-indigo gradient, mint accent). Tokens in `src/components/theme.ts`.
- Open: Android backup policy, monetization.

## Brand Commitments

Calm, non-judgemental voice: never blame ("gastou demais"), never push into debt ("parcele", "pegue um empréstimo"). Values marked "estimado" whenever not confirmed.

## Evidence on Hand

Only the spec in the Obsidian vault (`Life Strategic Plan/`, notes 01–11) and the example spreadsheet with dummy data (`assets/examples/life-strategic-plan-exemplo.xlsx`). No users, testimonials or benchmarks exist; do not invent them. The owner's personal financial figures must never appear in the app, docs or examples.

## Product Principles

1. Show the consequence before the decision, in money and dates.
2. Calm over alarm: colour plus words, never colour alone, never blame.
3. The user's numbers, the user's sources: every assumption visible and editable.
4. Compare, don't recommend: the app ranks options the user informed and never offers credit or investments.

## Accessibility & Inclusion

WCAG 2.2 AA: text contrast at least 4.5:1, screen-reader labels and announcements for status changes, touch targets of at least 44 pt.
