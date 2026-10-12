import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { GuestSession, GuestSessionService } from './guest-session.service';

export type GuestRequest = Request & { guest: GuestSession };

// Guard das rotas do CONVIDADO. Mesmo formato do JwtAuthGuard (header
// "Authorization: Bearer <token>", repassado pelo servidor do Next a partir
// do cookie httpOnly), mas valida o token de convidado, não o do dono.
//
// Ele só prova "esta sessão é válida e é do evento X" (request.guest.eventId).
// Conferir que o evento da URL (:slug) é o mesmo é responsabilidade de quem
// carrega o evento — porque aqui não há acesso ao banco.
@Injectable()
export class GuestAuthGuard implements CanActivate {
  constructor(private readonly guestSessionService: GuestSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { guest?: GuestSession }>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Sessão de convidado ausente');
    }

    request.guest = await this.guestSessionService.verify(token);
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers['authorization'];
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
