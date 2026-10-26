import { describe, expect, it } from 'vitest';
import { availableLimit } from './limit';
import { makeProfile, nubank } from './testing';

describe('available limit', () => {
  it('prefers the value the user informed', () => {
    const card = { ...nubank, availableInformed: 4321 };
    expect(availableLimit(makeProfile({ cards: [card] }), card, '2026-11-01')).toEqual({ value: 4321, estimated: false });
  });
  it('estimates limit − open invoice − future installments before closing', () => {
    // Nov 1: the open invoice is Nov (closes Nov 5) = 1200 + 800; the Dec installment is not billed yet.
    const profile = makeProfile({ installments: [...makeProfile().installments, { id: 'p2', cardId: 'nu', dueMonth: '2026-12', amount: 300 }] });
    expect(availableLimit(profile, nubank, '2026-11-01')).toEqual({ value: 10000 - 2000 - 300, estimated: true });
  });
  it('also counts a closed invoice that is not due yet', () => {
    // Nov 8: Nov closed on the 5th (2000, due the 12th); the open one is Dec (800).
    expect(availableLimit(makeProfile(), nubank, '2026-11-08')).toEqual({ value: 10000 - 800 - 2000, estimated: true });
  });
});
