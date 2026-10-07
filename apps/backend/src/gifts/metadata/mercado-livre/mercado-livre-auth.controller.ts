import { BadRequestException, Controller, Get, Query, Res, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { MercadoLivreTokenService } from './mercado-livre-token.service';

// Estado CSRF efêmero do fluxo OAuth. Todo o ciclo (connect -> autorizar no
// ML -> callback) dura segundos, então não precisa sobreviver a um restart
// do processo — por isso em memória, sem tabela no banco pra isso.
const pendingStates = new Set<string>();
const STATE_TTL_MS = 10 * 60 * 1000;

@Controller('auth/mercadolivre')
export class MercadoLivreAuthController {
  constructor(private readonly tokenService: MercadoLivreTokenService) {}

  // Protegida por uma chave de setup via query string, não por JWT — essa
  // rota é acessada digitando/colando a URL direto no navegador (é assim
  // que o fluxo de OAuth funciona), e um navegador não tem como anexar um
  // header Authorization numa navegação comum. É uma ação administrativa
  // de configuração do sistema (uma conta só, pro MVP inteiro), não uma
  // ação de usuário final — por isso essa chave simples é suficiente aqui.
  @Get('connect')
  connect(@Query('key') key: string | undefined, @Res() res: Response) {
    const setupKey = process.env.MERCADOLIVRE_SETUP_KEY;
    if (!setupKey) {
      throw new BadRequestException('MERCADOLIVRE_SETUP_KEY não configurada no backend.');
    }
    if (key !== setupKey) {
      throw new UnauthorizedException('Chave de configuração inválida.');
    }

    const clientId = process.env.MERCADOLIVRE_CLIENT_ID;
    const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'MERCADOLIVRE_CLIENT_ID / MERCADOLIVRE_REDIRECT_URI não configurados no backend.',
      );
    }

    const state = randomBytes(16).toString('hex');
    pendingStates.add(state);
    setTimeout(() => pendingStates.delete(state), STATE_TTL_MS);

    const authUrl = new URL('https://auth.mercadolivre.com.br/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);

    return res.redirect(authUrl.toString());
  }

  // PÚBLICA, por necessidade: é o próprio Mercado Livre quem redireciona o
  // navegador pra cá depois da autorização — essa requisição não carrega
  // nenhum cookie/JWT nosso. A proteção real aqui é o "code" (só o ML tem)
  // somado ao "state" (prova que essa resposta corresponde a um connect
  // que a gente mesmo iniciou, não uma tentativa forjada por outra pessoa).
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    if (oauthError) {
      throw new BadRequestException(`Autorização recusada pelo Mercado Livre (${oauthError}).`);
    }
    if (!state || !pendingStates.has(state)) {
      throw new BadRequestException(
        'State inválido ou expirado. Inicie a conexão de novo em /auth/mercadolivre/connect.',
      );
    }
    pendingStates.delete(state);

    if (!code) {
      throw new BadRequestException('Código de autorização ausente.');
    }

    const clientId = process.env.MERCADOLIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET;
    const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI;

    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId ?? '',
        client_secret: clientSecret ?? '',
        code,
        redirect_uri: redirectUri ?? '',
      }),
    });

    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      // De propósito não logamos "data" inteiro — pode conter token.
      throw new BadRequestException(
        `Não foi possível concluir a autorização (${data.error ?? tokenResponse.status}).`,
      );
    }

    await this.tokenService.saveInitialToken(data.access_token, data.refresh_token, data.expires_in);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(
      '<html><body style="font-family: sans-serif; text-align:center; padding-top: 80px;">' +
        '<h1>Mercado Livre conectado ✅</h1>' +
        '<p>Pode fechar esta aba.</p>' +
        '</body></html>',
    );
  }
}
