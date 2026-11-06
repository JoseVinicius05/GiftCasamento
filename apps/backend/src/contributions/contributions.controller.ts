import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContributionsService } from './contributions.service';
import { ConfirmContributionDto } from './dto/confirm-contribution.dto';
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

  // "Recebi": confirma o Pix de uma cota. `{ acceptExpired: true }` é o
  // "Recebi mesmo assim" (cota vencida/cancelada). O dono vem SEMPRE do token;
  // a cota só é achada dentro de um evento dele (senão, 404).
  @Post('contributions/:contributionId/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Param('slug') slug: string,
    @Param('contributionId', ParseUUIDPipe) contributionId: string,
    @Body() dto: ConfirmContributionDto,
    @Req() request: Request & { userId: string },
  ) {
    return this.contributionsService.confirm(slug, request.userId, contributionId, dto?.acceptExpired === true);
  }

  // "Não recebi": a cota pendente vira `expired` e o valor volta a ficar disponível.
  @Post('contributions/:contributionId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('slug') slug: string,
    @Param('contributionId', ParseUUIDPipe) contributionId: string,
    @Req() request: Request & { userId: string },
  ) {
    return this.contributionsService.reject(slug, request.userId, contributionId);
  }
}
