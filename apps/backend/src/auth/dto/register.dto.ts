import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @Transform(trim)
  @IsString({ message: 'Nome inválido' })
  @IsNotEmpty({ message: 'Informe seu nome' })
  @MaxLength(100, { message: 'Nome muito longo (máximo 100 caracteres)' })
  name: string;

  // e-mail sempre salvo em minúsculas, pra "Ana@x.com" e "ana@x.com" serem o mesmo usuário
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(254, { message: 'E-mail muito longo' })
  email: string;

  @IsString({ message: 'Senha inválida' })
  @MinLength(8, { message: 'A senha precisa ter pelo menos 8 caracteres' })
  @MaxLength(72, { message: 'A senha pode ter no máximo 72 caracteres' })
  password: string;
}
