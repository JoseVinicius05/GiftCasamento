import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Rate limit (ThrottlerModule configurado no AuthModule): no máximo 5
  // tentativas de login por IP a cada 60s, pra dificultar força bruta.
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Rota de teste do Dia 3: só prova que o JwtAuthGuard funciona.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: Request & { userId: string }) {
    return this.authService.validateUserById(request.userId);
  }
}
