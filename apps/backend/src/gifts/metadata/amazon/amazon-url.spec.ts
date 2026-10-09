import { canonicalAmazonUrl, extractAsin, isAmazonShortLink } from './amazon-url';

describe('isAmazonShortLink', () => {
  it('reconhece os encurtadores da Amazon', () => {
    expect(isAmazonShortLink('https://a.co/d/0gcrIYNQ')).toBe(true);
    expect(isAmazonShortLink('https://amzn.to/3abcDEF')).toBe(true);
    expect(isAmazonShortLink('https://amzn.eu/d/xyz')).toBe(true);
    expect(isAmazonShortLink('https://amzn.asia/d/xyz')).toBe(true);
  });

  it('não se deixa enganar por domínio parecido', () => {
    expect(isAmazonShortLink('https://a.co.evil.com/d/x')).toBe(false);
    expect(isAmazonShortLink('https://evil.com/a.co/d/x')).toBe(false);
    expect(isAmazonShortLink('https://notamzn.to/x')).toBe(false);
  });

  it('link completo da Amazon e lixo não são encurtadores', () => {
    expect(isAmazonShortLink('https://www.amazon.com.br/dp/B0ABCDEFGH')).toBe(false);
    expect(isAmazonShortLink('não é url')).toBe(false);
    expect(isAmazonShortLink('ftp://a.co/d/x')).toBe(false);
  });
});

describe('extractAsin / canonicalAmazonUrl', () => {
  it('extrai o ASIN de /dp/, /gp/product/ e URLs com slug e query', () => {
    expect(extractAsin('https://www.amazon.com.br/dp/B0ABCDEFGH')).toBe('B0ABCDEFGH');
    expect(extractAsin('https://www.amazon.com.br/gp/product/B0ABCDEFGH?x=1')).toBe('B0ABCDEFGH');
    expect(
      extractAsin('https://www.amazon.com.br/Nome-Do-Produto/dp/b0abcdefgh/ref=sr_1_1?keywords=x'),
    ).toBe('B0ABCDEFGH');
  });

  it('sem ASIN devolve null', () => {
    expect(extractAsin('https://www.amazon.com.br/s?k=liquidificador')).toBeNull();
  });

  it('canônico: tira slug e rastreio, mantém o domínio (br ou com)', () => {
    expect(
      canonicalAmazonUrl('https://www.amazon.com.br/Nome/dp/B0ABCDEFGH/ref=x?tag=abc&psc=1'),
    ).toBe('https://www.amazon.com.br/dp/B0ABCDEFGH');
    expect(canonicalAmazonUrl('https://amazon.com/dp/B0ABCDEFGH')).toBe(
      'https://www.amazon.com/dp/B0ABCDEFGH',
    );
  });

  it('destino que não é produto (busca) ou não é Amazon devolve null', () => {
    expect(canonicalAmazonUrl('https://www.amazon.com.br/s?k=x')).toBeNull();
    expect(canonicalAmazonUrl('https://evil.com/dp/B0ABCDEFGH')).toBeNull();
  });
});
