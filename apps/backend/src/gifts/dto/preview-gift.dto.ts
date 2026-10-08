import { IsString, IsUrl, MaxLength } from 'class-validator';

export class PreviewGiftDto {
  @IsString()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Cole um link válido (começando com http:// ou https://)' },
  )
  @MaxLength(2048)
  url: string;
}
