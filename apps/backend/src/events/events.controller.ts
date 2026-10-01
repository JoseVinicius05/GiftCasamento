import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

// Todas as rotas de evento exigem um dono autenticado — por isso o guard
// fica no controller inteiro, não rota por rota.
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEventDto, @Req() request: Request & { userId: string }) {
    return this.eventsService.create(dto, request.userId);
  }

  // Lista só os eventos do dono logado — nunca de outro usuário.
  @Get()
  findAllMine(@Req() request: Request & { userId: string }) {
    return this.eventsService.findAllByOwner(request.userId);
  }
}
