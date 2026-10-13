import {
  deriveGiftStatus,
  isTerminalGiftStatus,
  minContributionCents,
  toCents,
} from './gift-reservation.util';

describe('toCents', () => {
  it('converte número, string e Decimal-like sem erro de ponto flutuante', () => {
    expect(toCents(300)).toBe(30000);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents('19.99')).toBe(1999);
    expect(toCents({ toString: () => '120.50' })).toBe(12050);
  });
});

describe('deriveGiftStatus', () => {
  it('sem nada reservado: available — mesmo que o gravado esteja velho', () => {
    expect(deriveGiftStatus('fully_funded', 300, 0)).toBe('available');
    expect(deriveGiftStatus('partially_funded', 300, 0)).toBe('available');
  });

  it('parte reservada: partially_funded', () => {
    expect(deriveGiftStatus('available', 300, 100)).toBe('partially_funded');
  });

  it('reservado igual ou acima do preço: fully_funded', () => {
    expect(deriveGiftStatus('partially_funded', 300, 300)).toBe('fully_funded');
    expect(deriveGiftStatus('available', 300, 350)).toBe('fully_funded');
  });

  it('purchased_via_link e confirmed nunca mudam (não derivam das cotas)', () => {
    expect(deriveGiftStatus('purchased_via_link', 300, 0)).toBe('purchased_via_link');
    expect(deriveGiftStatus('confirmed', 300, 0)).toBe('confirmed');
  });

  it('não é enganado por ponto flutuante (299,70 + 0,30 = 300)', () => {
    expect(deriveGiftStatus('available', 300, 299.7 + 0.3)).toBe('fully_funded');
  });
});

describe('minContributionCents', () => {
  it('R$ 10 quando há bastante disponível', () => {
    expect(minContributionCents(30000)).toBe(1000);
    expect(minContributionCents(1000)).toBe(1000);
  });

  it('o restante, quando é menos de R$ 10', () => {
    expect(minContributionCents(700)).toBe(700);
    expect(minContributionCents(1)).toBe(1);
  });
});

describe('isTerminalGiftStatus', () => {
  it('só purchased_via_link e confirmed', () => {
    expect(isTerminalGiftStatus('purchased_via_link')).toBe(true);
    expect(isTerminalGiftStatus('confirmed')).toBe(true);
    expect(isTerminalGiftStatus('fully_funded')).toBe(false);
    expect(isTerminalGiftStatus('available')).toBe(false);
  });
});
