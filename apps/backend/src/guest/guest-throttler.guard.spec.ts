import { GuestThrottlerGuard } from './guest-throttler.guard';

describe('GuestThrottlerGuard', () => {
  // getTracker é protected: o que se testa aqui é só a chave do contador.
  const guard = new (GuestThrottlerGuard as any)({}, {}, {}) as { getTracker(req: any): Promise<string> };

  it('conta pela SESSÃO do convidado, não pelo IP', async () => {
    const tracker = await guard.getTracker({ guest: { sid: 'sess-1' }, ip: '203.0.113.7' });

    expect(tracker).toBe('sess-1');
  });

  it('dois convidados atrás do mesmo IP (o do servidor do Next) têm contadores separados', async () => {
    const a = await guard.getTracker({ guest: { sid: 'sess-a' }, ip: '203.0.113.7' });
    const b = await guard.getTracker({ guest: { sid: 'sess-b' }, ip: '203.0.113.7' });

    expect(a).not.toBe(b);
  });

  it('a mesma sessão cai sempre no mesmo contador', async () => {
    const first = await guard.getTracker({ guest: { sid: 'sess-1' }, ip: '203.0.113.7' });
    const second = await guard.getTracker({ guest: { sid: 'sess-1' }, ip: '198.51.100.2' });

    expect(first).toBe(second);
  });

  it('sem sessão na request, cai no IP (comportamento padrão)', async () => {
    expect(await guard.getTracker({ ip: '203.0.113.7' })).toBe('203.0.113.7');
  });
});
