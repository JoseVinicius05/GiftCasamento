import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextWith(headers: Record<string, string>) {
  const request: any = { headers };
  const context: any = { switchToHttp: () => ({ getRequest: () => request }) };
  return { context, request };
}

describe('JwtAuthGuard', () => {
  let jwtService: { verifyAsync: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    guard = new JwtAuthGuard(jwtService as any);
  });

  it('token de dono válido: libera e põe o userId na request', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
    const { context, request } = contextWith({ authorization: 'Bearer ok' });

    expect(await guard.canActivate(context)).toBe(true);
    expect(request.userId).toBe('user-1');
  });

  it('sem token: 401', async () => {
    const { context } = contextWith({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('token assinado mas SEM sub: 401 (nunca libera com userId indefinido)', async () => {
    jwtService.verifyAsync.mockResolvedValue({ eventId: 'evt-1' });
    const { context } = contextWith({ authorization: 'Bearer x' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('token marcado como de convidado: 401, mesmo que tenha sub', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', typ: 'guest' });
    const { context } = contextWith({ authorization: 'Bearer x' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
