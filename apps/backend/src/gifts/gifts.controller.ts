import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from '../events/events.service';
import { CreateGiftDto } from './dto/create-gift.dto';
import { PreviewGiftDto } from './dto/preview-gift.dto';
import { UpdateGiftDto } from './dto/update-gift.dto';
import { GiftsService } from './gifts.service';
import { MetadataService } from './metadata/metadata.service';

// Todas as rotas daqui são do DONO do evento: o JwtAuthGuard no nível da
// classe roda primeiro em todas; a checagem de ownership (404) acontece no
// serviço, antes de qualquer acesso aos presentes.
@UseGuards(JwtAuthGuard)
@Controller('events/:slug/gifts')
export class GiftsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly metadataService: MetadataService,
    private readonly giftsService: GiftsService,
  ) {}

  // Só busca e devolve os metadados — NÃO salva nada. O rate limit vale só
  // aqui: esta rota aciona serviços externos pagos (Bright Data/Microlink),
  // então é a mais cara de abusar.
  @UseGuards(ThrottlerGuard)
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Param('slug') slug: string,
    @Body() dto: PreviewGiftDto,
    @Req() request: Request & { userId: string },
  ) {
    // 404 (nunca 403) se o evento não existe OU pertence a outro dono. Vem
    // ANTES de qualquer chamada externa, pra um usuário sem acesso não gastar
    // cota de API.
    await this.eventsService.findBySlugForOwner(slug, request.userId);

    return this.metadataService.preview(dto.url);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('slug') slug: string,
    @Body() dto: CreateGiftDto,
    @Req() request: Request & { userId: string },
  ) {
    return this.giftsService.create(slug, dto, request.userId);
  }

  @Get()
  findAll(@Param('slug') slug: string, @Req() request: Request & { userId: string }) {
    return this.giftsService.findAll(slug, request.userId);
  }

  @Patch(':giftId')
  update(
    @Param('slug') slug: string,
    @Param('giftId', ParseUUIDPipe) giftId: string,
    @Body() dto: UpdateGiftDto,
    @Req() request: Request & { userId: string },
  ) {
    return this.giftsService.update(slug, giftId, dto, request.userId);
  }
}
