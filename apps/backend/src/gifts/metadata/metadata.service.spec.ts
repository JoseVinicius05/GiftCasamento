import { UnprocessableEntityException } from '@nestjs/common';
import { detectStore } from './store-detector';
import { MetadataService, UNSUPPORTED_ECOMMERCE } from './metadata.service';

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

  it('não se deixa enganar por domínio parecido', () => {
    expect(detectStore('https://mercadolivre.com.br.evil.com/x')).toBeNull();
    expect(detectStore('https://evil.com/amazon.com.br')).toBeNull();
    expect(detectStore('https://notamazon.com.br/dp/1')).toBeNull();
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
  let service: MetadataService;

  beforeEach(() => {
    mercadoLivre = { fetchMetadata: jest.fn() };
    amazon = { extract: jest.fn() };
    service = new MetadataService(mercadoLivre as any, amazon as any);
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
});
