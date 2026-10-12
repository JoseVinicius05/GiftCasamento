import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyGuestAccessDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha do evento' })
  @MaxLength(72)
  password: string;

  // Nome auto-declarado (não verificado) — aparece pro dono quando o
  // convidado reservar um presente. Espaços sobrando viram um só.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome' })
  @MinLength(2, { message: 'O nome precisa ter pelo menos 2 caracteres' })
  @MaxLength(60, { message: 'Nome muito longo (máximo 60 caracteres)' })
  name: string;
}
