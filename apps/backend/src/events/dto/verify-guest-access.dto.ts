import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyGuestAccessDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha do evento' })
  @MaxLength(72)
  password: string;
}
