import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Rate limit das rotas AUTENTICADAS do convidado, contado por SESSÃO e não por
// IP.
//
// Por quê: todo o tráfego do convidado passa pelo servidor do Next (BFF), então
// o backend enxerga o IP de SAÍDA do Next, não o do convidado. Contando por IP,
// vários convidados (e até eventos diferentes) cairiam no mesmo balde e um
// casamento inteiro poderia receber "muitas tentativas" sem ninguém abusar.
//
// Funciona porque o GuestAuthGuard (nível da classe) roda ANTES deste guard (nível
// da rota) e já deixa a sessão em `request.guest`. Sem sessão (não deveria
// acontecer nestas rotas), cai no IP, como o ThrottlerGuard normal.
//
// Limite conhecido: quem tem a senha do evento pode abrir várias sessões
// (cada /access gera uma nova) — mas /access continua com limite por IP.
@Injectable()
export class GuestThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.guest?.sid ?? req.ip;
  }
}
