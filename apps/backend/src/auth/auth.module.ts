import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    // Rate limit só aplicado no /auth/login (ver @UseGuards no controller):
    // no máximo 5 tentativas por IP a cada 60 segundos, pra dificultar força bruta.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // Exporta JwtModule (não só o guard) porque o JwtAuthGuard depende do
  // JwtService por baixo — sem re-exportar o módulo que o fornece, o Nest
  // não consegue resolver essa dependência em outros módulos (como o
  // EventsModule) que só importam o AuthModule.
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
