import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Valida todos os DTOs automaticamente e descarta campos que não existem no DTO.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, // necessário pro cookie httpOnly (JWT) do Dia 3
  });

  const port = process.env.PORT || 3001;
  // 0.0.0.0 é necessário em Render/Railway (senão o serviço não recebe tráfego externo)
  await app.listen(port, '0.0.0.0');
  console.log(`Backend rodando na porta ${port}`);
}
bootstrap();
