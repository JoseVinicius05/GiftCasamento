import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { MetadataModule } from './gifts/metadata/metadata.module';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule, MetadataModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
