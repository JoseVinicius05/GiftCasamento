import { MercadoLivreService } from './mercado-livre.service';
import { MercadoLivreAuthError } from './mercado-livre-token.service';

// Nunca bate na API real do Mercado Livre nem no site: fetch é substituído
// por um mock em todos os testes.
const CATALOG_URL = 'https://www.mercadolivre.com.br/liquidificador/p/MLB67008669';
const CLASSIC_URL = 'https://produto.mercadolivre.com.br/MLB-3456789012-titulo_JM';

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

// Resposta de uma página (usada pela descoberta por redirect).
function pageResponse(status: number, location?: string) {
  return {
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'location' ? location ?? null : null) },
    body: { cancel: async () => {} },
  };
}

function multigetOk(item: Record<string, unknown>) {
  return jsonResponse(200, [{ code: 200, body: item }]);
}
function multigetForbidden() {
  return jsonResponse(200, [{ code: 403, body: { error: 'forbidden' } }]);
}

describe('MercadoLivreService', () => {
  let tokenService: { getValidAccessToken: jest.Mock; forceRefresh: jest.Mock };
  let fetchMock: jest.Mock;
  let service: MercadoLivreService;

  // Roteia o fetch pela URL, pra misturar API do ML e páginas do site.
  function routeFetch(routes: Array<[RegExp, () => unknown]>) {
    fetchMock.mockImplementation(async (url: string) => {
      for (const [pattern, respond] of routes) {
        if (pattern.test(url)) return respond();
      }
      throw new Error(`fetch inesperado nos testes: ${url}`);
    });
  }

  beforeEach(() => {
    tokenService = {
      getValidAccessToken: jest.fn().mockResolvedValue('token-velho'),
      forceRefresh: jest.fn().mockResolvedValue('token-novo'),
    };
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    service = new MercadoLivreService(tokenService as any);
  });

  describe('camada 1 — catálogo (/p/MLB...)', () => {
    it('catálogo sem buy_box_winner: devolve título e imagem, preço null', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          name: 'Monitor Gamer Samsung Odyssey G5',
          pictures: [{ url: 'https://http2.mlstatic.com/monitor.jpg' }],
          buy_box_winner: null,
        }),
      );

      const result = await service.fetchMetadata(CATALOG_URL);

      expect(result).toEqual({
        title: 'Monitor Gamer Samsung Odyssey G5',
        imageUrl: 'https://http2.mlstatic.com/monitor.jpg',
        price: null,
        currency: null,
        source: 'mercadolivre-api',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.mercadolibre.com/products/MLB67008669');
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-velho');
    });

    it('se algum dia o catálogo trouxer buy_box_winner com preço, aproveita', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          name: 'Liquidificador',
          pictures: [{ url: 'https://img/l.jpg' }],
          buy_box_winner: { price: 349.9, currency_id: 'BRL' },
        }),
      );

      const result = await service.fetchMetadata(CATALOG_URL);

      expect(result.price).toBe(349.9);
      expect(result.currency).toBe('BRL');
    });

    it('link de recomendação (catálogo + wid): se o catálogo responde, para por aí (1 chamada)', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { name: 'X', pictures: [] }));
      const url =
        'https://www.mercadolivre.com.br/x/p/MLB67008669#polycard_client=a&wid=MLB5214413673';

      await service.fetchMetadata(url);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain('/products/MLB67008669');
    });

    it('catálogo falha mas a URL tem wid: tenta o multiget do item', async () => {
      routeFetch([
        [/\/products\//, () => jsonResponse(404, {})],
        [/\/items\?ids=MLB5214413673/, () => multigetOk({ title: 'Via wid', price: 120, currency_id: 'BRL', pictures: [] })],
      ]);
      const url = 'https://www.mercadolivre.com.br/x/p/MLB67008669#wid=MLB5214413673';

      const result = await service.fetchMetadata(url);

      expect(result.title).toBe('Via wid');
      expect(result.price).toBe(120);
    });
  });

  describe('camadas 2 e 3 — links sem /p/MLB', () => {
    it('multiget funcionando devolve título, imagem e PREÇO (1 chamada só)', async () => {
      fetchMock.mockResolvedValue(
        multigetOk({
          title: 'Anúncio',
          price: 99.5,
          currency_id: 'BRL',
          pictures: [{ url: 'http://img/a.jpg', secure_url: 'https://img/a.jpg' }],
        }),
      );

      const result = await service.fetchMetadata(CLASSIC_URL);

      expect(result).toEqual({
        title: 'Anúncio',
        imageUrl: 'https://img/a.jpg',
        price: 99.5,
        currency: 'BRL',
        source: 'mercadolivre-api',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain('/items?ids=MLB3456789012&attributes=');
    });

    it('multiget bloqueado + página redireciona pro catálogo: usa /products', async () => {
      routeFetch([
        [/api\.mercadolibre\.com\/items\?ids=/, () => multigetForbidden()],
        [/produto\.mercadolivre\.com\.br\/MLB-/, () => pageResponse(301, 'https://www.mercadolivre.com.br/liquidificador/p/MLB555')],
        [/api\.mercadolibre\.com\/products\/MLB555/, () => jsonResponse(200, { name: 'Do catálogo', pictures: [{ url: 'https://img/c.jpg' }] })],
      ]);

      const result = await service.fetchMetadata(CLASSIC_URL);

      expect(result.title).toBe('Do catálogo');
      expect(result.imageUrl).toBe('https://img/c.jpg');
      expect(result.price).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('multiget bloqueado + página sem redirect: devolve campos vazios (modo manual)', async () => {
      routeFetch([
        [/api\.mercadolibre\.com\/items\?ids=/, () => multigetForbidden()],
        [/produto\.mercadolivre\.com\.br\/MLB-/, () => pageResponse(200)],
      ]);

      const result = await service.fetchMetadata(CLASSIC_URL);

      expect(result).toEqual({ title: null, imageUrl: null, price: null, currency: null, source: null });
    });

    it('redirect apontando pra fora do Mercado Livre é ignorado (nem chega a pedir)', async () => {
      routeFetch([
        [/api\.mercadolibre\.com\/items\?ids=/, () => multigetForbidden()],
        [/produto\.mercadolivre\.com\.br\/MLB-/, () => pageResponse(302, 'https://evil.example.com/p/MLB1')],
      ]);

      const result = await service.fetchMetadata(CLASSIC_URL);

      expect(result.title).toBeNull();
      const pediuEvil = fetchMock.mock.calls.some((c: any[]) => String(c[0]).includes('evil.example.com'));
      expect(pediuEvil).toBe(false);
    });
  });

  describe('token', () => {
    it('401 renova o token e repete UMA vez, com o token novo', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(401, { message: 'invalid access token' }))
        .mockResolvedValueOnce(jsonResponse(200, { name: 'Produto', pictures: [] }));

      const result = await service.fetchMetadata(CATALOG_URL);

      expect(result.title).toBe('Produto');
      expect(tokenService.forceRefresh).toHaveBeenCalledTimes(1);
      expect(tokenService.forceRefresh).toHaveBeenCalledWith('token-velho');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-novo');
    });

    it('401 duas vezes seguidas: desiste (sem loop) e devolve campos vazios', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, {}));

      const result = await service.fetchMetadata(CATALOG_URL);

      expect(result.title).toBeNull();
      expect(tokenService.forceRefresh).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('invalid_grant ao buscar o token NÃO lança: devolve campos vazios e nem chama a API', async () => {
      tokenService.getValidAccessToken.mockRejectedValue(
        new MercadoLivreAuthError('refresh recusado', 'invalid_grant'),
      );

      const result = await service.fetchMetadata(CATALOG_URL);

      expect(result).toEqual({ title: null, imageUrl: null, price: null, currency: null, source: null });
      expect(fetchMock).toHaveBeenCalledTimes(0);
    });

    it('invalid_grant durante o retry do 401 também não lança', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, {}));
      tokenService.forceRefresh.mockRejectedValue(
        new MercadoLivreAuthError('refresh recusado', 'invalid_grant'),
      );

      const result = await service.fetchMetadata(CATALOG_URL);

      expect(result.title).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('casos de borda', () => {
    it('URL sem ID MLB: devolve vazio sem nem pedir token', async () => {
      const result = await service.fetchMetadata('https://www.mercadolivre.com.br/ofertas');

      expect(result.title).toBeNull();
      expect(tokenService.getValidAccessToken).toHaveBeenCalledTimes(0);
      expect(fetchMock).toHaveBeenCalledTimes(0);
    });

    it('erro de rede (fetch rejeita) não lança', async () => {
      fetchMock.mockRejectedValue(new Error('timeout'));

      const result = await service.fetchMetadata(CATALOG_URL);

      expect(result.title).toBeNull();
    });
  });
});
