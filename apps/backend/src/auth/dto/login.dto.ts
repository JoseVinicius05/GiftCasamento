import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsString({ message: 'Senha inválida' })
  @MinLength(1, { message: 'Informe a senha' })
  @MaxLength(72, { message: 'Senha inválida' })
  password: string;
}
