import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Rota de teste pra validar que o backend está de pé (checklist do Dia 1)
  @Get('health')
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
