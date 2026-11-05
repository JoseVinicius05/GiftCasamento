import { IsIn, IsOptional } from 'class-validator';

export const CONTRIBUTION_FILTERS = ['pending', 'expired', 'confirmed'] as const;
export type ContributionFilter = (typeof CONTRIBUTION_FILTERS)[number];

export class ListContributionsQueryDto {
  // Filtra pelo status EFETIVO (pendente com prazo vencido conta como 'expired').
  @IsOptional()
  @IsIn(CONTRIBUTION_FILTERS, { message: 'status deve ser pending, expired ou confirmed' })
  status?: ContributionFilter;
}
