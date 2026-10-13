import { IsIn } from 'class-validator';

export class ClaimGiftDto {
  // 'pix'  = pagar tudo o que falta por Pix (vira uma cota do valor restante)
  // 'link' = "comprei pelo link da loja" (fecha o presente)
  @IsIn(['pix', 'link'], { message: 'Escolha como presentear: pix ou link' })
  method: 'pix' | 'link';
}
