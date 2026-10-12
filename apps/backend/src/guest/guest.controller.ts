import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { GuestAuthGuard, GuestRequest } from '../auth/guest-auth.guard';
import { GuestService } from './guest.service';

// Rotas do CONVIDADO (sessão de convidado, não o JWT do dono). Ficam sob
// /events/:slug/guest/... pra nunca colidirem com as rotas do dono.
@UseGuards(GuestAuthGuard)
@Controller('events/:slug/guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Get('overview')
  overview(@Param('slug') slug: string, @Req() request: GuestRequest) {
    return this.guestService.getOverview(slug, request.guest);
  }
}
