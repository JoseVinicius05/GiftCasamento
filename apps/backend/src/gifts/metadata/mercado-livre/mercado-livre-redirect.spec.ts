import { discoverCatalogId } from './mercado-livre-redirect';

function pageResponse(status: number, location?: string) {
  return {
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'location' ? location ?? null : null) },
    body: { cancel: async () => {} },
  };
}

describe('discoverCatalogId', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('URL que já é de catálogo: devolve o ID sem fazer nenhuma requisição', async () => {
    const id = await discoverCatalogId('https://www.mercadolivre.com.br/x/p/MLB123');

    expect(id).toBe('MLB123');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('segue o redirect até a página de catálogo e lê só o cabeçalho (sem seguir automático)', async () => {
    fetchMock.mockResolvedValue(
      pageResponse(301, 'https://www.mercadolivre.com.br/liquidificador/p/MLB999'),
    );

    const id = await discoverCatalogId('https://produto.mercadolivre.com.br/MLB-111-x_JM');

    expect(id).toBe('MLB999');
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('aceita redirect relativo (Location sem domínio)', async () => {
    fetchMock.mockResolvedValue(pageResponse(302, '/liquidificador/p/MLB777'));

    const id = await discoverCatalogId('https://produto.mercadolivre.com.br/MLB-111-x_JM');

    expect(id).toBe('MLB777');
  });

  it('redirect pra fora do Mercado Livre: aborta sem pedir o outro domínio', async () => {
    fetchMock.mockResolvedValue(pageResponse(302, 'https://evil.example.com/p/MLB1'));

    const id = await discoverCatalogId('https://produto.mercadolivre.com.br/MLB-111-x_JM');

    expect(id).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('domínio de entrada que não é do ML nunca é requisitado', async () => {
    const id = await discoverCatalogId('https://mercadolivre.com.br.evil.com/MLB-1-x');

    expect(id).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('página 200 (sem redirect, ex: tela de verificação): devolve null', async () => {
    fetchMock.mockResolvedValue(pageResponse(200));

    expect(await discoverCatalogId('https://produto.mercadolivre.com.br/MLB-111-x_JM')).toBeNull();
  });

  it('erro de rede devolve null (sem lançar)', async () => {
    fetchMock.mockRejectedValue(new Error('bloqueado'));

    expect(await discoverCatalogId('https://produto.mercadolivre.com.br/MLB-111-x_JM')).toBeNull();
  });

  it('desiste depois de poucos saltos (sem loop infinito)', async () => {
    fetchMock.mockResolvedValue(pageResponse(302, 'https://www.mercadolivre.com.br/outra-pagina'));

    expect(await discoverCatalogId('https://www.mercadolivre.com.br/pagina')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
