import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };

// Todos opcionais (PATCH). Pra apagar o link ou a imagem, mande null —
// o @IsOptional() do class-validator ignora tanto undefined quanto null.
// priceSource NÃO é editável aqui: quando o dono muda o preço, o backend
// marca 'manual' sozinho.
export class UpdateGiftDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'O nome do presente não pode ficar vazio' })
  @MaxLength(200, { message: 'Nome muito longo (máximo 200 caracteres)' })
  title?: string;

  @IsOptional()
  @Transform(trimString)
  @IsUrl(URL_OPTIONS, { message: 'Link do produto inválido (precisa começar com http:// ou https://)' })
  @MaxLength(2048, { message: 'Link do produto muito longo' })
  productUrl?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsUrl(URL_OPTIONS, { message: 'Link da imagem inválido (precisa começar com http:// ou https://)' })
  @MaxLength(2048, { message: 'Link da imagem muito longo' })
  imageUrl?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe um preço válido (até 2 casas decimais)' })
  @IsPositive({ message: 'O preço precisa ser maior que zero' })
  @Max(99_999_999.99, { message: 'Preço muito alto' })
  price?: number;
}
