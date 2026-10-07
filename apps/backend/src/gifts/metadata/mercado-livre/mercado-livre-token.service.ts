import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

// Margem de segurança antes da expiração real (~6h do Mercado Livre) —
// nunca tentamos usar um token que está prestes a vencer.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Única linha da tabela: uma conta de integração do ML pro MVP inteiro.
const TOKEN_ROW_ID = 1;

@Injectable()
export class MercadoLivreTokenService {
  private readonly logger = new Logger(MercadoLivreTokenService.name);

  // Lock em memória: se duas chamadas precisarem de refresh ao mesmo tempo,
  // a segunda espera o resultado da primeira em vez de disparar um refresh
  // concorrente — o refresh_token do ML é de uso único (rotativo), então
  // dois refreshes simultâneos invalidariam um ao outro.
  //
  // Limitação conhecida (documentada no planejamento, não escondida): esse
  // lock só vale dentro de UM processo. Se o backend um dia rodar em mais de
  // uma instância, isso precisa de um lock distribuído (Postgres/Redis) —
  // fica como débito técnico explícito, não resolvido hoje.
  private refreshPromise: Promise<string> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getValidAccessToken(): Promise<string> {
    const token = await this.prisma.mercadoLivreToken.findUnique({
      where: { id: TOKEN_ROW_ID },
    });

    if (!token) {
      throw new Error(
        'Mercado Livre ainda não foi conectado. Peça a um dono logado para acessar ' +
          'GET /auth/mercadolivre/connect e autorizar o app.',
      );
    }

    const willExpireSoon = token.expiresAt.getTime() - Date.now() <= REFRESH_MARGIN_MS;
    if (!willExpireSoon) {
      return token.accessToken;
    }

    return this.refreshAccessToken(token.refreshToken);
  }

  // Chamado só pelo controller de callback, na primeira autorização.
  async saveInitialToken(
    accessToken: string,
    refreshToken: string,
    expiresInSeconds: number,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await this.prisma.mercadoLivreToken.upsert({
      where: { id: TOKEN_ROW_ID },
      create: { id: TOKEN_ROW_ID, accessToken, refreshToken, expiresAt },
      update: { accessToken, refreshToken, expiresAt },
    });

    this.logger.log('Token inicial do Mercado Livre salvo com sucesso.');
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh(refreshToken).finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async doRefresh(refreshToken: string): Promise<string> {
    const clientId = process.env.MERCADOLIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET;

    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId ?? '',
        client_secret: clientSecret ?? '',
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Nunca logar o corpo inteiro da resposta — pode conter token.
      // Só o código do erro (ex: "invalid_grant") é seguro de registrar.
      this.logger.error(`Falha ao renovar token do Mercado Livre: ${data.error ?? response.status}`);

      // "invalid_grant" = o refresh token não é mais válido, a autorização
      // precisa ser refeita do zero (ver seção 5.9 do planejamento). Quem
      // chama este serviço (o MetadataService, Dia 3) decide o que fazer
      // com isso — aqui só propagamos um erro claro, sem decidir fallback.
      throw new Error(`Falha ao renovar token do Mercado Livre (${data.error ?? 'erro desconhecido'})`);
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await this.prisma.mercadoLivreToken.update({
      where: { id: TOKEN_ROW_ID },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // rotativo — sempre o novo
        expiresAt,
      },
    });

    this.logger.log('Token do Mercado Livre renovado com sucesso.');
    return data.access_token;
  }
}
