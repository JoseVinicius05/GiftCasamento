import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GuestSessionService } from './guest-session.service';

describe('GuestSessionService', () => {
  const originalSecret = process.env.JWT_SECRET;
  let jwtService: JwtService;
  let service: GuestSessionService;

  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste';
    // Mesmo registro do AuthModule: a chave "padrão" é a do DONO.
    jwtService = new JwtService({ secret: process.env.JWT_SECRET });
    service = new GuestSessionService(jwtService);
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('cria um token que volta com evento, nome e um sid aleatório', async () => {
    const { token, session } = await service.create('evt-1', 'Maria Souza');

    expect(session.eventId).toBe('evt-1');
    expect(session.name).toBe('Maria Souza');
    expect(session.sid).toMatch(/^[0-9a-f-]{36}$/);
    expect(await service.verify(token)).toEqual(session);
  });

  it('cada acesso gera um sid diferente', async () => {
    const a = await service.create('evt-1', 'Maria');
    const b = await service.create('evt-1', 'Maria');

    expect(a.session.sid).not.toBe(b.session.sid);
  });

  it('rejeita lixo e token vazio', async () => {
    await expect(service.verify('isso-nao-e-um-jwt')).rejects.toThrow(UnauthorizedException);
    await expect(service.verify('')).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita um token de DONO (assinado com a chave do dono)', async () => {
    const ownerToken = await jwtService.signAsync({ sub: 'user-1' });

    await expect(service.verify(ownerToken)).rejects.toThrow(UnauthorizedException);
  });

  it('o token de convidado NÃO é aceito como token de dono', async () => {
    const { token } = await service.create('evt-1', 'Maria');

    // verifyAsync sem opções usa a chave do dono → assinatura não bate.
    await expect(jwtService.verifyAsync(token)).rejects.toBeDefined();
  });

  it('rejeita token com a chave certa mas sem o formato de convidado', async () => {
    const { token } = await service.create('evt-1', 'Maria');
    const secret = (service as any).secret as string;
    const decoded = jwtService.decode(token) as Record<string, unknown>;
    const { typ: _typ, ...semTipo } = decoded;
    const forged = await jwtService.signAsync(semTipo, { secret });

    await expect(service.verify(forged)).rejects.toThrow(UnauthorizedException);
  });
});
