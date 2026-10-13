import { buildPixPayload, crc16, normalizePixKey } from './pix-payload';

// Lê o BR Code como lista de campos { id, value } (TLV: 2 dígitos de id, 2 de
// tamanho, valor). Se algum tamanho estiver errado, o parse quebra/descasa.
function parseTlv(text: string): { id: string; value: string }[] {
  const fields: { id: string; value: string }[] = [];
  let i = 0;
  while (i < text.length) {
    const id = text.slice(i, i + 2);
    const length = Number(text.slice(i + 2, i + 4));
    const value = text.slice(i + 4, i + 4 + length);
    if (value.length !== length) throw new Error(`TLV inválido em ${i}`);
    fields.push({ id, value });
    i += 4 + length;
  }
  return fields;
}

describe('crc16', () => {
  it('bate com o vetor de teste padrão do CRC16/CCITT-FALSE ("123456789" → 29B1)', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('sempre devolve 4 caracteres hexadecimais maiúsculos', () => {
    expect(crc16('')).toBe('FFFF');
    expect(crc16('a')).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe('normalizePixKey', () => {
  it('e-mail: minúsculo', () => {
    expect(normalizePixKey('  Ana.Joao@Example.com ')).toBe('ana.joao@example.com');
  });

  it('chave aleatória (UUID): minúsculo', () => {
    expect(normalizePixKey('123E4567-E89B-12D3-A456-426614174000')).toBe(
      '123e4567-e89b-12d3-a456-426614174000',
    );
  });

  it('CPF com pontuação: só os dígitos', () => {
    expect(normalizePixKey('529.982.247-25')).toBe('52998224725');
  });

  it('CPF sem pontuação (dígitos verificadores batem): continua CPF', () => {
    expect(normalizePixKey('52998224725')).toBe('52998224725');
  });

  it('CNPJ com ou sem pontuação: só os dígitos', () => {
    expect(normalizePixKey('11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizePixKey('11222333000181')).toBe('11222333000181');
  });

  it('celular formatado ou com +55 vira +55DDDNÚMERO', () => {
    expect(normalizePixKey('(44) 99999-8888')).toBe('+5544999998888');
    expect(normalizePixKey('+55 44 99999-8888')).toBe('+5544999998888');
  });

  it('11 dígitos que NÃO são CPF válido viram celular', () => {
    expect(normalizePixKey('44999998888')).toBe('+5544999998888');
  });

  it('11 dígitos repetidos não são CPF', () => {
    expect(normalizePixKey('11111111111')).toBe('+5511111111111');
  });

  it('o que não dá pra normalizar com segurança devolve null', () => {
    expect(normalizePixKey('')).toBeNull();
    expect(normalizePixKey('minha chave')).toBeNull();
    expect(normalizePixKey('12345')).toBeNull();
    expect(normalizePixKey('ação@exemplo.com')).toBeNull(); // fora do ASCII
    expect(normalizePixKey(`${'a'.repeat(80)}@x.com`)).toBeNull(); // passa de 77
  });
});

describe('buildPixPayload', () => {
  const base = {
    key: 'ana.joao@example.com',
    amount: 25.5,
    merchantName: 'José da Silva Júnior',
    txid: '0b2f1c4e-77aa-4d3e-9f10-aabbccddeeff',
  };

  it('monta os campos na ordem do BR Code, com os tamanhos certos', () => {
    const payload = buildPixPayload(base)!;
    const fields = parseTlv(payload);

    expect(fields.map((f) => f.id)).toEqual(
      ['00', '01', '26', '52', '53', '54', '58', '59', '60', '62', '63'],
    );
    expect(payload.startsWith('000201')).toBe(true);
  });

  it('carrega a chave, o valor com 2 casas e a moeda BRL', () => {
    const fields = parseTlv(buildPixPayload(base)!);
    const get = (id: string) => fields.find((f) => f.id === id)!.value;

    expect(parseTlv(get('26'))).toEqual([
      { id: '00', value: 'BR.GOV.BCB.PIX' },
      { id: '01', value: 'ana.joao@example.com' },
    ]);
    expect(get('54')).toBe('25.50');
    expect(get('53')).toBe('986');
    expect(get('58')).toBe('BR');
  });

  it('o CRC do final confere com o resto do texto', () => {
    const payload = buildPixPayload(base)!;

    expect(payload.slice(-8, -4)).toBe('6304');
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it('nome sem acento, maiúsculo e com no máximo 25 caracteres; cidade padrão BRASIL', () => {
    const fields = parseTlv(buildPixPayload(base)!);

    expect(fields.find((f) => f.id === '59')!.value).toBe('JOSE DA SILVA JUNIOR');
    expect(fields.find((f) => f.id === '60')!.value).toBe('BRASIL');

    const longo = parseTlv(
      buildPixPayload({ ...base, merchantName: 'Maria Aparecida dos Santos Albuquerque' })!,
    );
    expect(longo.find((f) => f.id === '59')!.value.length).toBeLessThanOrEqual(25);
  });

  it('o txid vira só letras/números (até 25); sem txid usa ***', () => {
    const comTxid = parseTlv(parseTlv(buildPixPayload(base)!).find((f) => f.id === '62')!.value);
    expect(comTxid).toEqual([{ id: '05', value: '0b2f1c4e77aa4d3e9f10aabbc' }]);

    const semTxid = parseTlv(
      parseTlv(buildPixPayload({ ...base, txid: undefined })!).find((f) => f.id === '62')!.value,
    );
    expect(semTxid).toEqual([{ id: '05', value: '***' }]);
  });

  it('normaliza a chave digitada pelo dono antes de usar', () => {
    const fields = parseTlv(buildPixPayload({ ...base, key: '(44) 99999-8888' })!);
    const account = parseTlv(fields.find((f) => f.id === '26')!.value);

    expect(account[1]).toEqual({ id: '01', value: '+5544999998888' });
  });

  it('chave que não dá pra normalizar: null (a tela mostra só a chave)', () => {
    expect(buildPixPayload({ ...base, key: 'minha chave maluca' })).toBeNull();
  });

  it('valor inválido: null', () => {
    expect(buildPixPayload({ ...base, amount: 0 })).toBeNull();
    expect(buildPixPayload({ ...base, amount: -5 })).toBeNull();
    expect(buildPixPayload({ ...base, amount: Number.NaN })).toBeNull();
  });
});
