import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGiftDto } from './dto/create-gift.dto';
import { PreviewGiftDto } from './dto/preview-gift.dto';
import { UpdateGiftDto } from './dto/update-gift.dto';

const AMAZON_URL = 'https://www.amazon.com.br/dp/B0ABCDEFGH';

async function check<T extends object>(cls: new () => T, body: Record<string, unknown>) {
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto);
  return { dto, errors, failed: (property: string) => errors.some((e) => e.property === property) };
}

describe('CreateGiftDto', () => {
  const valid = { title: 'Liquidificador', price: 249.9, priceSource: 'manual' };

  it('aceita o mínimo: nome, preço e origem do preço', async () => {
    expect((await check(CreateGiftDto, valid)).errors).toHaveLength(0);
  });

  it('aceita link e imagem http/https', async () => {
    const { errors } = await check(CreateGiftDto, { ...valid, productUrl: AMAZON_URL, imageUrl: 'http://img.example.com/a.jpg' });

    expect(errors).toHaveLength(0);
  });

  it('link e imagem em branco viram "não enviado" (não falham na validação de URL)', async () => {
    const { dto, errors } = await check(CreateGiftDto, { ...valid, productUrl: '   ', imageUrl: '' });

    expect(errors).toHaveLength(0);
    expect(dto.productUrl).toBeUndefined();
    expect(dto.imageUrl).toBeUndefined();
  });

  it('só http/https: javascript:, ftp: e link sem protocolo são recusados', async () => {
    for (const url of ['javascript:alert(1)', 'ftp://example.com/a', 'www.amazon.com.br/dp/B0ABCDEFGH', 'não é um link']) {
      expect((await check(CreateGiftDto, { ...valid, productUrl: url })).failed('productUrl')).toBe(true);
      expect((await check(CreateGiftDto, { ...valid, imageUrl: url })).failed('imageUrl')).toBe(true);
    }
  });

  it('link muito longo é recusado', async () => {
    const url = `https://example.com/${'a'.repeat(2100)}`;

    expect((await check(CreateGiftDto, { ...valid, productUrl: url })).failed('productUrl')).toBe(true);
  });

  it('nome: apara espaços; vazio, só espaços ou acima de 200 caracteres falham', async () => {
    const { dto, errors } = await check(CreateGiftDto, { ...valid, title: '  Liquidificador  ' });
    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('Liquidificador');

    expect((await check(CreateGiftDto, { ...valid, title: '' })).failed('title')).toBe(true);
    expect((await check(CreateGiftDto, { ...valid, title: '   ' })).failed('title')).toBe(true);
    expect((await check(CreateGiftDto, { ...valid, title: 'a'.repeat(201) })).failed('title')).toBe(true);
  });

  it('preço: obrigatório, positivo, até 2 casas e dentro do limite do banco', async () => {
    expect((await check(CreateGiftDto, { title: 'X', priceSource: 'manual' })).failed('price')).toBe(true);
    expect((await check(CreateGiftDto, { ...valid, price: 0 })).failed('price')).toBe(true);
    expect((await check(CreateGiftDto, { ...valid, price: -10 })).failed('price')).toBe(true);
    expect((await check(CreateGiftDto, { ...valid, price: 10.123 })).failed('price')).toBe(true);
    expect((await check(CreateGiftDto, { ...valid, price: '10' })).failed('price')).toBe(true);
    expect((await check(CreateGiftDto, { ...valid, price: 100_000_000 })).failed('price')).toBe(true);
    expect((await check(CreateGiftDto, { ...valid, price: 99_999_999.99 })).errors).toHaveLength(0);
  });

  it("origem do preço: só 'auto' ou 'manual'", async () => {
    expect((await check(CreateGiftDto, { ...valid, priceSource: 'auto' })).errors).toHaveLength(0);
    expect((await check(CreateGiftDto, { ...valid, priceSource: 'outro' })).failed('priceSource')).toBe(true);
    expect((await check(CreateGiftDto, { title: 'X', price: 10 })).failed('priceSource')).toBe(true);
  });
});

describe('UpdateGiftDto', () => {
  it('PATCH vazio é válido (todos os campos são opcionais)', async () => {
    expect((await check(UpdateGiftDto, {})).errors).toHaveLength(0);
  });

  it('aceita editar só um campo de cada vez', async () => {
    expect((await check(UpdateGiftDto, { title: 'Novo nome' })).errors).toHaveLength(0);
    expect((await check(UpdateGiftDto, { price: 350 })).errors).toHaveLength(0);
    expect((await check(UpdateGiftDto, { productUrl: AMAZON_URL })).errors).toHaveLength(0);
  });

  it('null apaga o link e a imagem (é o único jeito: texto vazio é recusado)', async () => {
    expect((await check(UpdateGiftDto, { productUrl: null, imageUrl: null })).errors).toHaveLength(0);
    expect((await check(UpdateGiftDto, { productUrl: '' })).failed('productUrl')).toBe(true);
  });

  it('nome: apara espaços; em branco ou longo demais falha', async () => {
    const { dto, errors } = await check(UpdateGiftDto, { title: '  Novo  ' });
    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('Novo');

    expect((await check(UpdateGiftDto, { title: '   ' })).failed('title')).toBe(true);
    expect((await check(UpdateGiftDto, { title: 'a'.repeat(201) })).failed('title')).toBe(true);
  });

  it('só http/https nos links', async () => {
    expect((await check(UpdateGiftDto, { productUrl: 'javascript:alert(1)' })).failed('productUrl')).toBe(true);
    expect((await check(UpdateGiftDto, { imageUrl: 'ftp://example.com/a.jpg' })).failed('imageUrl')).toBe(true);
  });

  it('preço: positivo, até 2 casas e dentro do limite', async () => {
    expect((await check(UpdateGiftDto, { price: 0 })).failed('price')).toBe(true);
    expect((await check(UpdateGiftDto, { price: -1 })).failed('price')).toBe(true);
    expect((await check(UpdateGiftDto, { price: 1.999 })).failed('price')).toBe(true);
    expect((await check(UpdateGiftDto, { price: 100_000_000 })).failed('price')).toBe(true);
  });
});

describe('PreviewGiftDto', () => {
  it('aceita um link http/https', async () => {
    expect((await check(PreviewGiftDto, { url: AMAZON_URL })).errors).toHaveLength(0);
    expect((await check(PreviewGiftDto, { url: 'https://a.co/d/abc123' })).errors).toHaveLength(0);
  });

  it('recusa ausente, texto solto, sem protocolo e outros protocolos', async () => {
    for (const body of [{}, { url: '' }, { url: 'abc' }, { url: 'www.amazon.com.br/dp/B0ABCDEFGH' }, { url: 'javascript:alert(1)' }, { url: 'ftp://example.com/x' }, { url: 123 }]) {
      expect((await check(PreviewGiftDto, body)).failed('url')).toBe(true);
    }
  });

  it('recusa link com mais de 2048 caracteres', async () => {
    expect((await check(PreviewGiftDto, { url: `https://example.com/${'a'.repeat(2100)}` })).failed('url')).toBe(true);
  });
});
