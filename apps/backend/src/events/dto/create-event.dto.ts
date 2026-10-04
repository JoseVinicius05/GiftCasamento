import { Transform } from 'class-transformer';
import { EventType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { IsNotPastDate } from '../is-not-past-date.validator';

export class CreateEventDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Dê um título para o evento' })
  @MaxLength(150, { message: 'Título muito longo (máximo 150 caracteres)' })
  title: string;

  // Valida contra o enum gerado pelo Prisma — se um tipo novo for adicionado
  // no schema.prisma, a validação aqui acompanha sozinha, sem precisar duplicar a lista.
  @IsEnum(EventType, { message: 'Tipo de evento inválido' })
  eventType: EventType;

  @IsDateString({}, { message: 'Data do evento inválida' })
  @IsNotPastDate()
  eventDate: string;

  @IsString({ message: 'Senha de convidado inválida' })
  @MinLength(4, { message: 'A senha dos convidados precisa ter pelo menos 4 caracteres' })
  @MaxLength(72, { message: 'Senha de convidado muito longa' })
  guestPassword: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Informe sua chave Pix' })
  @MaxLength(140, { message: 'Chave Pix muito longa' })
  pixKey: string;
}
