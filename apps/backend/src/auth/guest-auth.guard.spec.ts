import { UnauthorizedException } from '@nestjs/common';
import { GuestAuthGuard } from './guest-auth.guard';

function contextWith(headers: Record<string, string>) {
  const request: any = { headers };
  const context: any = { switchToHttp: () => ({ getRequest: () => request }) };
  return { context, request };
}

describe('GuestAuthGuard', () => {
  let sessions: { verify: jest.Mock };
  let guard: GuestAuthGuard;

  beforeEach(() => {
    sessions = { verify: jest.fn() };
    guard = new GuestAuthGuard(sessions as any);
  });

  it('sem header Authorization: 401 e nem tenta validar', async () => {
    const { context } = contextWith({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(sessions.verify).not.toHaveBeenCalled();
  });

  it('header que não é Bearer: 401', async () => {
    const { context } = contextWith({ authorization: 'Basic abc' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('token inválido: o 401 do serviço propaga', async () => {
    sessions.verify.mockRejectedValue(new UnauthorizedException('Sessão de convidado inválida ou expirada'));
    const { context } = contextWith({ authorization: 'Bearer ruim' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('token válido: libera e põe a sessão em request.guest', async () => {
    const session = { sid: 's1', eventId: 'evt-1', name: 'Maria' };
    sessions.verify.mockResolvedValue(session);
    const { context, request } = contextWith({ authorization: 'Bearer bom' });

    expect(await guard.canActivate(context)).toBe(true);
    expect(sessions.verify).toHaveBeenCalledWith('bom');
    expect(request.guest).toEqual(session);
  });
});
