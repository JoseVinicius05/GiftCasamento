import { parseMercadoLivreUrl } from './mercado-livre-url';

describe('parseMercadoLivreUrl', () => {
  it('link de recomendação: pega o productId do path e o wid (depois do #) como itemId', () => {
    const url =
      'https://www.mercadolivre.com.br/liquidificador-arno/p/MLB67008669' +
      '#polycard_client=recommendations_home&wid=MLB5214413673&sid=recos';

    expect(parseMercadoLivreUrl(url)).toEqual({
      productId: 'MLB67008669',
      itemId: 'MLB5214413673',
    });
  });

  it('wid na query string (antes do #) também funciona', () => {
    const url = 'https://www.mercadolivre.com.br/monitor/p/MLB46056259?wid=MLB5369904562';

    expect(parseMercadoLivreUrl(url)).toEqual({
      productId: 'MLB46056259',
      itemId: 'MLB5369904562',
    });
  });

  it('página de catálogo sem wid: só productId (nunca confunde com itemId)', () => {
    const url = 'https://www.mercadolivre.com.br/liquidificador/p/MLB67008669';

    expect(parseMercadoLivreUrl(url)).toEqual({ productId: 'MLB67008669', itemId: null });
  });

  it('URL clássica de anúncio: só itemId', () => {
    const url = 'https://produto.mercadolivre.com.br/MLB-3456789012-titulo-qualquer_JM';

    expect(parseMercadoLivreUrl(url)).toEqual({ productId: null, itemId: 'MLB3456789012' });
  });

  it('URL sem nenhum ID MLB devolve tudo null', () => {
    expect(parseMercadoLivreUrl('https://www.mercadolivre.com.br/ofertas')).toEqual({
      productId: null,
      itemId: null,
    });
  });

  it('texto que não é URL devolve tudo null (sem lançar)', () => {
    expect(parseMercadoLivreUrl('isso não é url')).toEqual({ productId: null, itemId: null });
  });
});
