import { UnprocessableEntityException } from '@nestjs/common';
import { detectStore } from './store-detector';
import { MetadataService, SHORT_LINK_UNRESOLVED, UNSUPPORTED_ECOMMERCE } from './metadata.service';

const EMPTY = { title: null, imageUrl: null, price: null, currency: null, source: null };

describe('detectStore', () => {
  it('reconhece domínios do Mercado Livre', () => {
    expect(detectStore('https://www.mercadolivre.com.br/x/p/MLB1')).toBe('mercadolivre');
    expect(detectStore('https://produto.mercadolivre.com.br/MLB-1-x_JM')).toBe('mercadolivre');
  });

  it('reconhece domínios da Amazon', () => {
    expect(detectStore('https://www.amazon.com.br/dp/B0ABC')).toBe('amazon');
    expect(detectStore('https://amazon.com/dp/B0ABC')).toBe('amazon');
  });

  it('links encurtados da Amazon contam como Amazon; os do ML ainda não', () => {
    expect(detectStore('https://a.co/d/0gcrIYNQ')).toBe('amazon');
    expect(detectStore('https://amzn.to/3abc')).toBe('amazon');
    expect(detectStore('https://meli.la/abc')).toBeNull();
  });

  it('não se deixa enganar por domínio parecido', () => {
    expect(detectStore('https://mercadolivre.com.br.evil.com/x')).toBeNull();
    expect(detectStore('https://evil.com/amazon.com.br')).toBeNull();
    expect(detectStore('https://notamazon.com.br/dp/1')).toBeNull();
    expect(detectStore('https://a.co.evil.com/d/x')).toBeNull();
  });

  it('outras lojas e URLs inválidas/não-http retornam null', () => {
    expect(detectStore('https://shopee.com.br/produto')).toBeNull();
    expect(detectStore('ftp://www.amazon.com.br/dp/1')).toBeNull();
    expect(detectStore('não é url')).toBeNull();
  });
});

describe('MetadataService', () => {
  let mercadoLivre: { fetchMetadata: jest.Mock };
  let amazon: { extract: jest.Mock };
  let amazonShortLink: { resolve: jest.Mock };
  let service: MetadataService;

  beforeEach(() => {
    mercadoLivre = { fetchMetadata: jest.fn() };
    amazon = { extract: jest.fn() };
    amazonShortLink = { resolve: jest.fn() };
    service = new MetadataService(mercadoLivre as any, amazon as any, amazonShortLink as any);
  });

  it('loja não suportada lança 422 com code UNSUPPORTED_ECOMMERCE e não chama nenhum extractor', async () => {
    const promise = service.preview('https://shopee.com.br/produto-x');

    await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException);
    await promise.catch((e) => {
      expect(e.getResponse().code).toBe(UNSUPPORTED_ECOMMERCE);
    });
    expect(mercadoLivre.fetchMetadata).toHaveBeenCalledTimes(0);
    expect(amazon.extract).toHaveBeenCalledTimes(0);
  });

  it('Mercado Livre: encaminha pro ML e marca o preço como faltando (caso normal)', async () => {
    mercadoLivre.fetchMetadata.mockResolvedValue({
      title: 'Monitor',
      imageUrl: 'https://img/m.jpg',
      price: null,
      currency: null,
      source: 'mercadolivre-api',
    });

    const result = await service.preview('https://www.mercadolivre.com.br/m/p/MLB46056259');

    expect(result.store).toBe('mercadolivre');
    expect(result.title).toBe('Monitor');
    expect(result.missingFields).toEqual(['price']);
    expect(amazon.extract).toHaveBeenCalledTimes(0);
  });

  it('Amazon completa: nenhum campo faltando', async () => {
    amazon.extract.mockResolvedValue({
      title: 'Fone',
      imageUrl: 'https://img/f.jpg',
      price: 199.9,
      currency: 'BRL',
      source: 'brightdata',
    });

    const result = await service.preview('https://www.amazon.com.br/dp/B0ABC');

    expect(result.store).toBe('amazon');
    expect(result.missingFields).toEqual([]);
    expect(mercadoLivre.fetchMetadata).toHaveBeenCalledTimes(0);
  });

  it('sem nenhum dado: todos os campos faltando, mas SEM erro (modo manual)', async () => {
    mercadoLivre.fetchMetadata.mockResolvedValue(EMPTY);

    const result = await service.preview('https://www.mercadolivre.com.br/x/p/MLB1');

    expect(result.missingFields).toEqual(['title', 'imageUrl', 'price']);
  });

  it('se o extractor lançar exceção, não vira 500: devolve tudo vazio', async () => {
    amazon.extract.mockRejectedValue(new Error('bug inesperado'));

    const result = await service.preview('https://www.amazon.com.br/dp/B0ABC');

    expect(result.store).toBe('amazon');
    expect(result.missingFields).toEqual(['title', 'imageUrl', 'price']);
  });

  it('link normal: resolvedUrl é a própria URL colada', async () => {
    mercadoLivre.fetchMetadata.mockResolvedValue(EMPTY);

    const result = await service.preview('https://www.mercadolivre.com.br/x/p/MLB1');

    expect(result.resolvedUrl).toBe('https://www.mercadolivre.com.br/x/p/MLB1');
    expect(amazonShortLink.resolve).toHaveBeenCalledTimes(0);
  });

  it('link encurtado da Amazon: resolve ANTES, busca pelo link completo e devolve ele em resolvedUrl', async () => {
    amazonShortLink.resolve.mockResolvedValue('https://www.amazon.com.br/dp/B0ABCDEFGH');
    amazon.extract.mockResolvedValue({
      title: 'Fone',
      imageUrl: 'https://img/f.jpg',
      price: 199.9,
      currency: 'BRL',
      source: 'brightdata',
    });

    const result = await service.preview('https://a.co/d/0gcrIYNQ');

    expect(amazonShortLink.resolve).toHaveBeenCalledWith('https://a.co/d/0gcrIYNQ');
    expect(amazon.extract).toHaveBeenCalledWith('https://www.amazon.com.br/dp/B0ABCDEFGH');
    expect(result.store).toBe('amazon');
    expect(result.resolvedUrl).toBe('https://www.amazon.com.br/dp/B0ABCDEFGH');
  });

  it('link encurtado que não resolve: 422 SHORT_LINK_UNRESOLVED e nenhum extractor é chamado', async () => {
    amazonShortLink.resolve.mockResolvedValue(null);

    const promise = service.preview('https://a.co/d/0gcrIYNQ');

    await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException);
    await promise.catch((e) => {
      expect(e.getResponse().code).toBe(SHORT_LINK_UNRESOLVED);
    });
    expect(amazon.extract).toHaveBeenCalledTimes(0);
  });
});
