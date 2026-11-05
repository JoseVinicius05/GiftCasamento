import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContributionsService } from './contributions.service';
import { ListContributionsQueryDto } from './dto/list-contributions-query.dto';

// Todas as rotas daqui são do DONO do evento: o JwtAuthGuard no nível da
// classe roda primeiro em todas; a checagem de ownership (404) acontece no
// serviço, antes de qualquer leitura de cotas.
@UseGuards(JwtAuthGuard)
@Controller('events/:slug')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  // Cotas do evento (o que cada convidado reservou), com status efetivo e a
  // referência (txid do QR) pra conciliar com o extrato.
  @Get('contributions')
  list(
    @Param('slug') slug: string,
    @Query() query: ListContributionsQueryDto,
    @Req() request: Request & { userId: string },
  ) {
    return this.contributionsService.list(slug, request.userId, query.status);
  }

  // Totais: confirmado, pendente, vencido, fundo extra e presentes comprados pelo link.
  @Get('summary')
  summary(@Param('slug') slug: string, @Req() request: Request & { userId: string }) {
    return this.contributionsService.summary(slug, request.userId);
  }
}
