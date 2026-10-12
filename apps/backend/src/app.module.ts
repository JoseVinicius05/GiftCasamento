import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { GiftsModule } from './gifts/gifts.module';
import { GuestModule } from './guest/guest.module';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule, GiftsModule, GuestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
