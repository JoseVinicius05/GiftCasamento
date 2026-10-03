import { Transform } from 'class-transformer';
import { EventType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Tudo opcional: o dono pode editar só o que quiser, sem reenviar o formulário
// inteiro. guestPassword NÃO entra aqui de propósito — trocar a senha dos
// convidados é uma ação sensível o bastante pra merecer sua própria rota no
// futuro (ex: POST /events/:slug/reset-guest-password), não um PATCH comum.
export class UpdateEventDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'O título não pode ficar vazio' })
  @MaxLength(150, { message: 'Título muito longo (máximo 150 caracteres)' })
  title?: string;

  @IsOptional()
  @IsEnum(EventType, { message: 'Tipo de evento inválido' })
  eventType?: EventType;

  @IsOptional()
  @IsDateString({}, { message: 'Data do evento inválida' })
  eventDate?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'A chave Pix não pode ficar vazia' })
  @MaxLength(140, { message: 'Chave Pix muito longa' })
  pixKey?: string;
}
