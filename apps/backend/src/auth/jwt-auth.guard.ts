import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

// Lê o token do header "Authorization: Bearer <token>" — não de cookie.
// Frontend e backend ficam em domínios diferentes (Vercel/Render), então o
// cookie httpOnly fica no domínio do frontend; é o servidor do Next (Route
// Handler) que repassa o token pro backend via esse header.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { userId?: string }>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; typ?: string }>(token);

      // Só aceita token de DONO (tem `sub` = id do usuário). O token de
      // convidado usa outra chave e já falharia na assinatura; esta checagem
      // é uma segunda trava, caso alguém um dia unifique as chaves por engano.
      if (typeof payload.sub !== 'string' || payload.typ === 'guest') {
        throw new UnauthorizedException('Token inválido ou expirado');
      }

      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers['authorization'];
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
