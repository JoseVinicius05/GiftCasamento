import { MercadoLivreAuthError, MercadoLivreTokenService } from './mercado-livre-token.service';

function tokenRow(accessToken: string, minutesUntilExpiry: number) {
  return {
    id: 1,
    accessToken,
    refreshToken: 'refresh-1',
    expiresAt: new Date(Date.now() + minutesUntilExpiry * 60_000),
  };
}

describe('MercadoLivreTokenService', () => {
  let prisma: { mercadoLivreToken: { findUnique: jest.Mock; update: jest.Mock; upsert: jest.Mock } };
  let fetchMock: jest.Mock;
  let service: MercadoLivreTokenService;

  beforeEach(() => {
    prisma = {
      mercadoLivreToken: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
    };
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    service = new MercadoLivreTokenService(prisma as any);
  });

  function refreshOk() {
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-novo', refresh_token: 'refresh-2', expires_in: 21600 }),
    };
  }

  it('getValidAccessToken devolve o token do banco quando ainda está longe de expirar', async () => {
    prisma.mercadoLivreToken.findUnique.mockResolvedValue(tokenRow('token-ok', 120));

    expect(await service.getValidAccessToken()).toBe('token-ok');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('getValidAccessToken lança MercadoLivreAuthError(not_connected) se nunca conectou', async () => {
    prisma.mercadoLivreToken.findUnique.mockResolvedValue(null);

    await expect(service.getValidAccessToken()).rejects.toMatchObject({ code: 'not_connected' });
  });

  it('duas chamadas simultâneas com token vencendo disparam só UM refresh', async () => {
    prisma.mercadoLivreToken.findUnique.mockResolvedValue(tokenRow('token-velho', 2));
    fetchMock.mockResolvedValue(refreshOk());

    const [a, b] = await Promise.all([
      service.getValidAccessToken(),
      service.getValidAccessToken(),
    ]);

    expect(a).toBe('token-novo');
    expect(b).toBe('token-novo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forceRefresh renova quando o token em uso ainda é o do banco', async () => {
    prisma.mercadoLivreToken.findUnique.mockResolvedValue(tokenRow('token-velho', 120));
    fetchMock.mockResolvedValue(refreshOk());

    expect(await service.forceRefresh('token-velho')).toBe('token-novo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forceRefresh NÃO renova de novo se outra requisição já trocou o token', async () => {
    prisma.mercadoLivreToken.findUnique.mockResolvedValue(tokenRow('token-ja-renovado', 120));

    expect(await service.forceRefresh('token-velho')).toBe('token-ja-renovado');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('invalid_grant vira MercadoLivreAuthError com o código, sem vazar token', async () => {
    prisma.mercadoLivreToken.findUnique.mockResolvedValue(tokenRow('token-velho', 1));
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', refresh_token: 'segredo' }),
    });

    const promise = service.getValidAccessToken();

    await expect(promise).rejects.toBeInstanceOf(MercadoLivreAuthError);
    await expect(promise).rejects.toMatchObject({ code: 'invalid_grant' });
    await expect(promise).rejects.toThrow(/invalid_grant/);
    await promise.catch((e) => expect(String(e.message)).not.toContain('segredo'));
  });
});
