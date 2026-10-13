import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GuestAuthGuard, GuestRequest } from '../auth/guest-auth.guard';
import { ClaimGiftDto } from './dto/claim-gift.dto';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { GuestClaimsService } from './guest-claims.service';
import { GuestContributionsService } from './guest-contributions.service';
import { GuestService } from './guest.service';

// Rotas do CONVIDADO (sessão de convidado, não o JWT do dono). Ficam sob
// /events/:slug/guest/... pra nunca colidirem com as rotas do dono.
@UseGuards(GuestAuthGuard)
@Controller('events/:slug/guest')
export class GuestController {
  constructor(
    private readonly guestService: GuestService,
    private readonly guestContributionsService: GuestContributionsService,
    private readonly guestClaimsService: GuestClaimsService,
  ) {}

  @Get('overview')
  overview(@Param('slug') slug: string, @Req() request: GuestRequest) {
    return this.guestService.getOverview(slug, request.guest);
  }

  // Reserva uma cota (valor parcial ou o restante) de um presente. Devolve os
  // dados de pagamento Pix — o único ponto em que a chave sai. Rate limit por
  // IP além do guard de sessão: cada chamada abre uma transação com lock.
  @UseGuards(ThrottlerGuard)
  @Post('gifts/:giftId/contributions')
  @HttpCode(HttpStatus.CREATED)
  createContribution(
    @Param('slug') slug: string,
    @Param('giftId', ParseUUIDPipe) giftId: string,
    @Body() dto: CreateContributionDto,
    @Req() request: GuestRequest,
  ) {
    return this.guestContributionsService.create(slug, giftId, request.guest, dto.amount);
  }

  // Presentear por completo: `{ method: 'pix' }` paga tudo o que falta (devolve
  // os dados de pagamento, igual à cota) e `{ method: 'link' }` marca "comprei
  // pelo link" e fecha o presente. Mesmo rate limit da criação de cota.
  @UseGuards(ThrottlerGuard)
  @Post('gifts/:giftId/claim')
  @HttpCode(HttpStatus.CREATED)
  claim(
    @Param('slug') slug: string,
    @Param('giftId', ParseUUIDPipe) giftId: string,
    @Body() dto: ClaimGiftDto,
    @Req() request: GuestRequest,
  ) {
    return this.guestClaimsService.claim(slug, giftId, request.guest, dto.method);
  }
}
