import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
} from 'class-validator';

// Texto vazio vira "não enviado" (undefined) — assim um campo opcional em
// branco no formulário não falha na validação de URL.
const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

// Só http/https: esses valores viram <a href> e <img src> na tela. Bloquear
// outros protocolos (ex: "javascript:") evita um link malicioso salvo aqui
// virar ataque no navegador de quem abrir a lista.
const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };

export class CreateGiftDto {
  // Opcional: o dono pode cadastrar um presente sem link (ex: "vaquinha").
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsUrl(URL_OPTIONS, { message: 'Link do produto inválido (precisa começar com http:// ou https://)' })
  @MaxLength(2048, { message: 'Link do produto muito longo' })
  productUrl?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome para o presente' })
  @MaxLength(200, { message: 'Nome muito longo (máximo 200 caracteres)' })
  title: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsUrl(URL_OPTIONS, { message: 'Link da imagem inválido (precisa começar com http:// ou https://)' })
  @MaxLength(2048, { message: 'Link da imagem muito longo' })
  imageUrl?: string;

  // O preço é SEMPRE confirmado pelo dono — no Mercado Livre ele nunca vem
  // do auto-fetch. Decimal(10,2) no banco: até 99.999.999,99.
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe um preço válido (até 2 casas decimais)' })
  @IsPositive({ message: 'O preço precisa ser maior que zero' })
  @Max(99_999_999.99, { message: 'Preço muito alto' })
  price: number;

  // 'auto' = o preço veio do serviço de metadados e o dono não mexeu;
  // 'manual' = o dono digitou/corrigiu.
  @IsIn(['auto', 'manual'], { message: 'Origem do preço inválida' })
  priceSource: 'auto' | 'manual';
}
