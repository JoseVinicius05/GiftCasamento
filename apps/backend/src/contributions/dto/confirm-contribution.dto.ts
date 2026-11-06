import { IsBoolean, IsOptional } from 'class-validator';

// Corpo do POST /events/:slug/contributions/:id/confirm.
//
// `acceptExpired` é o "Recebi mesmo assim": sem ele, confirmar uma cota que já
// venceu (ou foi cancelada) é recusado com 409 CONTRIBUTION_EXPIRED. Exigir o
// flag explícito evita que um clique distraído lance dinheiro em uma reserva
// que já tinha sido liberada para outros convidados.
export class ConfirmContributionDto {
  @IsOptional()
  @IsBoolean({ message: 'acceptExpired deve ser verdadeiro ou falso' })
  acceptExpired?: boolean;
}
