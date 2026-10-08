import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from '../events/events.service';
import { PreviewGiftDto } from './dto/preview-gift.dto';
import { MetadataService } from './metadata/metadata.service';

@Controller('events/:slug/gifts')
export class GiftsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly metadataService: MetadataService,
  ) {}

  // Só busca e devolve os metadados — NÃO salva nada (salvar é o
  // POST /events/:slug/gifts do Dia 4). A ordem dos guards importa: primeiro
  // JWT (quem é você), depois o rate limit (esta rota aciona serviços
  // externos pagos — Bright Data/Microlink — então é a mais cara de abusar).
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Param('slug') slug: string,
    @Body() dto: PreviewGiftDto,
    @Req() request: Request & { userId: string },
  ) {
    // Mesmo padrão do resto do módulo de eventos: 404 (nunca 403) se o
    // evento não existe OU pertence a outro dono. Vem ANTES de qualquer
    // chamada externa, pra um usuário sem acesso não gastar cota de API.
    await this.eventsService.findBySlugForOwner(slug, request.userId);

    return this.metadataService.preview(dto.url);
  }
}
