import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { VerifyGuestAccessDto } from './dto/verify-guest-access.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEventDto, @Req() request: Request & { userId: string }) {
    return this.eventsService.create(dto, request.userId);
  }

  // Lista só os eventos do dono logado — nunca de outro usuário.
  @UseGuards(JwtAuthGuard)
  @Get()
  findAllMine(@Req() request: Request & { userId: string }) {
    return this.eventsService.findAllByOwner(request.userId);
  }

  // :slug (não :id) por consistência com o resto da aplicação — o frontend
  // já navega pelos eventos usando o slug desde o "Meus eventos".
  @UseGuards(JwtAuthGuard)
  @Get(':slug')
  findOne(@Param('slug') slug: string, @Req() request: Request & { userId: string }) {
    return this.eventsService.findBySlugForOwner(slug, request.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':slug')
  update(
    @Param('slug') slug: string,
    @Body() dto: UpdateEventDto,
    @Req() request: Request & { userId: string },
  ) {
    return this.eventsService.update(slug, dto, request.userId);
  }

  // PÚBLICA — convidados não têm conta nem token. Rate limit próprio (não o
  // do login) porque a senha de convidado é curta (mín. 4 caracteres) e por
  // isso mais fácil de tentar força bruta; aqui sem "username" nenhum pra
  // separar tentativas, então vale travar cedo.
  @UseGuards(ThrottlerGuard)
  @Post(':slug/access')
  @HttpCode(HttpStatus.OK)
  verifyGuestAccess(@Param('slug') slug: string, @Body() dto: VerifyGuestAccessDto) {
    return this.eventsService.verifyGuestAccess(slug, dto.password);
  }
}
