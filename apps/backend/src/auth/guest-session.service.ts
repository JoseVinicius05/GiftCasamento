import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomUUID } from 'crypto';

// O que a sessão de convidado carrega. Convidado NÃO tem conta: o nome é
// auto-declarado (não verificado) e o `sid` é só um identificador aleatório
// da sessão — a Sprint 4 usa ele pra ligar cotas ao convidado que as criou,
// sem depender do nome (que pode se repetir).
export interface GuestSession {
  sid: string;
  eventId: string;
  name: string;
}

const GUEST_SESSION_TTL = '7d'; // mesmo prazo do cookie no frontend

// Cria e valida o token de convidado.
//
// Por que NÃO reaproveitar o JWT do dono? Segurança: se os dois tokens fossem
// assinados com a mesma chave, um token de convidado passaria no JwtAuthGuard
// (que só confere a assinatura). Aqui a chave é DERIVADA do JWT_SECRET (HMAC
// com um rótulo fixo): é outra chave, então um token de um tipo nunca é aceito
// pelo outro — e não precisamos de uma variável de ambiente nova.
@Injectable()
export class GuestSessionService {
  constructor(private readonly jwtService: JwtService) {}

  // Lazy (só quando usada) pra não quebrar a subida do Nest nem os testes
  // que não precisam do JWT_SECRET. O main.ts já aborta se ele não existir.
  private get secret(): string {
    const base = process.env.JWT_SECRET;
    if (!base) {
      throw new Error('JWT_SECRET não configurado');
    }
    return createHmac('sha256', base).update('webgift:guest-session').digest('hex');
  }

  async create(eventId: string, name: string): Promise<{ token: string; session: GuestSession }> {
    const session: GuestSession = { sid: randomUUID(), eventId, name };

    const token = await this.jwtService.signAsync(
      { typ: 'guest', ...session },
      { secret: this.secret, expiresIn: GUEST_SESSION_TTL },
    );

    return { token, session };
  }

  async verify(token: string): Promise<GuestSession> {
    let payload: Partial<GuestSession> & { typ?: string };

    try {
      payload = await this.jwtService.verifyAsync(token, { secret: this.secret });
    } catch {
      throw new UnauthorizedException('Sessão de convidado inválida ou expirada');
    }

    // Defesa em profundidade: além da assinatura, confere o formato.
    if (
      payload.typ !== 'guest' ||
      typeof payload.sid !== 'string' ||
      typeof payload.eventId !== 'string' ||
      typeof payload.name !== 'string'
    ) {
      throw new UnauthorizedException('Sessão de convidado inválida ou expirada');
    }

    return { sid: payload.sid, eventId: payload.eventId, name: payload.name };
  }
}
