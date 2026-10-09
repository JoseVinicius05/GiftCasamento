import { AmazonShortLinkService } from './amazon-short-link.service';

const SHORT = 'https://a.co/d/0gcrIYNQ';
const FULL = 'https://www.amazon.com.br/Nome-Do-Produto/dp/B0ABCDEFGH/ref=cm_sw_r_x?psc=1';
const CANONICAL = 'https://www.amazon.com.br/dp/B0ABCDEFGH';

function redirect(status: number, location?: string) {
  return {
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'location' ? location ?? null : null) },
    body: { cancel: async () => {} },
  };
}

describe('AmazonShortLinkService', () => {
  let microlink: { fetchFinalUrl: jest.Mock };
  let fetchMock: jest.Mock;
  let service: AmazonShortLinkService;

  beforeEach(() => {
    microlink = { fetchFinalUrl: jest.fn().mockResolvedValue(null) };
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    service = new AmazonShortLinkService(microlink as any);
  });

  it('camada 1: segue o redirect direto, devolve o link limpo e NÃO gasta o Microlink', async () => {
    fetchMock.mockResolvedValue(redirect(302, FULL));

    expect(await service.resolve(SHORT)).toBe(CANONICAL);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
    expect(microlink.fetchFinalUrl).toHaveBeenCalledTimes(0);
  });

  it('segue uma cadeia de encurtadores (a.co → amzn.to → produto)', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect(301, 'https://amzn.to/abc'))
      .mockResolvedValueOnce(redirect(302, FULL));

    expect(await service.resolve(SHORT)).toBe(CANONICAL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('redirect pra fora da Amazon: não segue (nunca pede o outro host) e tenta o Microlink', async () => {
    fetchMock.mockResolvedValue(redirect(302, 'https://evil.example.com/dp/B0ABCDEFGH'));

    expect(await service.resolve(SHORT)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(microlink.fetchFinalUrl).toHaveBeenCalledTimes(1);
  });

  it('camada 2: Amazon bloqueou o redirect (fetch falha) → Microlink resolve', async () => {
    fetchMock.mockRejectedValue(new Error('bloqueado'));
    microlink.fetchFinalUrl.mockResolvedValue(FULL);

    expect(await service.resolve(SHORT)).toBe(CANONICAL);
  });

  it('camada 2: resposta 200 sem redirect (tela de verificação) → Microlink resolve', async () => {
    fetchMock.mockResolvedValue(redirect(200));
    microlink.fetchFinalUrl.mockResolvedValue(FULL);

    expect(await service.resolve(SHORT)).toBe(CANONICAL);
  });

  it('Microlink devolvendo URL que não é produto da Amazon é descartada', async () => {
    fetchMock.mockRejectedValue(new Error('bloqueado'));
    microlink.fetchFinalUrl.mockResolvedValue('https://evil.example.com/dp/B0ABCDEFGH');

    expect(await service.resolve(SHORT)).toBeNull();
  });

  it('nenhuma camada funciona: devolve null (sem lançar)', async () => {
    fetchMock.mockRejectedValue(new Error('bloqueado'));

    expect(await service.resolve(SHORT)).toBeNull();
  });

  it('redirect que cai numa página da Amazon sem ASIN (ex: busca) não vale como produto', async () => {
    fetchMock.mockResolvedValue(redirect(302, 'https://www.amazon.com.br/s?k=liquidificador'));

    expect(await service.resolve(SHORT)).toBeNull();
  });
});
