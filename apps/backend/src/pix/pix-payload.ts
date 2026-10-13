// Gerador do "Pix Copia e Cola" ESTÁTICO (BR Code / EMV, padrão do Banco
// Central). É só uma função que monta um texto: o sistema NÃO fala com banco
// nenhum, não custodia nem move dinheiro — o convidado cola o texto (ou lê o
// QR) no app do banco dele e o Pix cai direto na conta do dono.

// ---------- CRC16/CCITT-FALSE (obrigatório no fim do BR Code) ----------
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// ---------- Chave Pix ----------
// A chave do evento é texto livre (o dono digita como quiser). O BR Code
// exige o formato "de máquina" de cada tipo; se não der pra normalizar com
// segurança devolvemos null — e a tela mostra só a chave pra copiar, sem QR.
// Melhor sem QR do que um QR que o banco recusa.
function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;

  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(digits[length])) return false;
  }
  return true;
}

const MAX_KEY_LENGTH = 77; // limite do campo 26 do BR Code

export function normalizePixKey(input: string): string | null {
  const raw = input.trim();
  if (!raw || !/^[\x20-\x7E]+$/.test(raw)) return null; // só ASCII imprimível

  // E-mail
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    const email = raw.toLowerCase();
    return email.length <= MAX_KEY_LENGTH ? email : null;
  }

  // Chave aleatória (UUID)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw.toLowerCase();
  }

  // CPF, CNPJ ou telefone (com ou sem pontuação)
  if (!/^\+?[\d\s().\-/]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');

  // Telefone escrito como telefone: "+55...", "(44) 99999-9999".
  const looksLikePhone = raw.startsWith('+') || /[()]/.test(raw);
  if (raw.startsWith('+')) return /^55\d{10,11}$/.test(digits) ? `+${digits}` : null;
  if (looksLikePhone) return /^\d{10,11}$/.test(digits) ? `+55${digits}` : null;

  if (digits.length === 14) return digits; // CNPJ
  if (digits.length === 11) {
    // 11 dígitos sem pontuação: CPF se os dígitos verificadores baterem,
    // senão celular com DDD. (Um celular que por acaso seja um CPF válido é
    // raro — ~1% — e o banco só recusaria, sem desviar dinheiro.)
    return isValidCpf(digits) ? digits : `+55${digits}`;
  }
  if (/^55\d{10,11}$/.test(digits)) return `+${digits}`;
  return null;
}

// ---------- Textos do recebedor ----------
// Nome ≤ 25 e cidade ≤ 15, só A-Z/0-9/espaço, maiúsculo, sem acento.
function toEmvText(raw: string, max: number, fallback: string): string {
  const text = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return text || fallback;
}

// ---------- Montagem ----------
function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

export interface PixPayloadInput {
  key: string; // texto livre; é normalizado aqui
  amount: number; // em reais, 2 casas
  merchantName: string;
  merchantCity?: string;
  txid?: string; // referência da cobrança (só letras/números, até 25)
}

// Devolve o Copia e Cola, ou null se a chave não puder virar um BR Code válido.
export function buildPixPayload(input: PixPayloadInput): string | null {
  const key = normalizePixKey(input.key);
  if (!key) return null;
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 99_999_999.99) {
    return null;
  }

  const txid = (input.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  const merchantAccount = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', key);

  const body =
    tlv('00', '01') + // versão do payload
    tlv('01', '11') + // 11 = QR estático
    tlv('26', merchantAccount) +
    tlv('52', '0000') + // categoria do recebedor (não informada)
    tlv('53', '986') + // moeda: BRL
    tlv('54', input.amount.toFixed(2)) +
    tlv('58', 'BR') +
    tlv('59', toEmvText(input.merchantName, 25, 'PRESENTE')) +
    tlv('60', toEmvText(input.merchantCity ?? '', 15, 'BRASIL')) +
    tlv('62', tlv('05', txid)) +
    '6304'; // o CRC é calculado sobre tudo, inclusive este "6304"

  return body + crc16(body);
}
