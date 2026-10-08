import { Injectable, Logger } from '@nestjs/common';
import { ProductMetadata } from '../types/product-metadata';
import { parseMercadoLivreUrl } from './mercado-livre-url';
import { MercadoLivreAuthError, MercadoLivreTokenService } from './mercado-livre-token.service';

const API_BASE = 'https://api.mercadolibre.com';
const TIMEOUT_MS = 8_000;

// Resultado interno de uma chamada à API do ML.
type MlResponse = { status: number; body: any };

// Busca título/imagem/preço de um produto do Mercado Livre.
//
// ESTRATÉGIA (decidida com testes reais no Dia 3 da Sprint 3):
//
// 1. Catálogo (/products/{productId}) é o caminho PRINCIPAL. É o único que
//    responde para anúncios de outros vendedores: GET /items/{id} devolve
//    403 access_denied mesmo com token OAuth válido (e 403
//    PA_UNAUTHORIZED_RESULT_FROM_POLICIES sem token).
// 2. /items/{itemId} só é tentado quando a URL NÃO tem ID de catálogo (URLs
//    clássicas de anúncio, /MLB-123-titulo_JM). Provavelmente vai dar 403 —
//    nesse caso o dono preenche tudo manualmente. Não vale gastar mais
//    chamadas tentando contornar isso.
// 3. O PREÇO NÃO VEM: o catálogo devolve buy_box_winner = null para os
//    produtos testados. Lemos buy_box_winner?.price caso algum dia venha,
//    mas o fluxo do MVP assume que no Mercado Livre o preço é preenchido
//    manualmente pelo dono (priceSource = 'manual').
// 4. NÃO usamos Microlink de fallback aqui: pro ML ele devolve só o título
//    e o logo genéricos do site ("Mercado Livre"), e isso seria pior que
//    campo vazio (pareceria um dado válido).
//
// Este serviço NUNCA lança exceção: qualquer falha (token, rede, 403, 404)
// vira "campos null". Falha de integração externa não pode travar o
// cadastro do presente — só cai pro preenchimento manual.
@Injectable()
export class MercadoLivreService {
  private readonly logger = new Logger(MercadoLivreService.name);

  constructor(private readonly tokenService: MercadoLivreTokenService) {}

  async fetchMetadata(url: string): Promise<ProductMetadata> {
    const { productId, itemId } = parseMercadoLivreUrl(url);

    if (!productId && !itemId) {
      this.logger.warn('Não encontrei nenhum ID MLB na URL do Mercado Livre.');
      return this.empty();
    }

    let accessToken: string;
    try {
      accessToken = await this.tokenService.getValidAccessToken();
    } catch (error) {
      this.logTokenProblem(error);
      return this.empty();
    }

    try {
      if (productId) {
        const response = await this.callApi(`/products/${productId}`, accessToken);
        if (response.status === 200) return this.fromProduct(response.body);
        this.logger.warn(`ML /products/${productId} respondeu ${response.status}.`);
        return this.empty();
      }

      // Sem catálogo: última tentativa pelo anúncio.
      const response = await this.callApi(`/items/${itemId}`, accessToken);
      if (response.status === 200) return this.fromItem(response.body);
      this.logger.warn(
        `ML /items/${itemId} respondeu ${response.status} — esperado para anúncios de ` +
          'outros vendedores; o dono vai preencher manualmente.',
      );
      return this.empty();
    } catch (error) {
      if (error instanceof MercadoLivreAuthError) {
        this.logTokenProblem(error);
      } else {
        this.logger.warn(`Erro ao consultar o Mercado Livre: ${(error as Error).message}`);
      }
      return this.empty();
    }
  }

  // Faz o GET autenticado. Se o ML responder 401, renova o token UMA vez e
  // repete UMA vez — nunca em loop. Se o refresh falhar (invalid_grant), o
  // MercadoLivreAuthError sobe pro fetchMetadata, que devolve campos vazios.
  private async callApi(path: string, accessToken: string): Promise<MlResponse> {
    const first = await this.get(path, accessToken);
    if (first.status !== 401) return first;

    this.logger.warn('ML respondeu 401 — renovando o token e tentando uma única vez de novo.');
    const freshToken = await this.tokenService.forceRefresh(accessToken);
    return this.get(path, freshToken);
  }

  private async get(path: string, accessToken: string): Promise<MlResponse> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    let body: any = null;
    try {
      body = await response.json();
    } catch {
      // corpo não era JSON — status já diz o suficiente
    }
    return { status: response.status, body };
  }

  private fromProduct(body: any): ProductMetadata {
    const winner = body?.buy_box_winner ?? null;
    const price = typeof winner?.price === 'number' ? winner.price : null;

    return {
      title: body?.name ?? null,
      imageUrl: body?.pictures?.[0]?.url ?? null,
      price,
      currency: price !== null ? winner?.currency_id ?? 'BRL' : null,
      source: 'mercadolivre-api',
    };
  }

  private fromItem(body: any): ProductMetadata {
    const price = typeof body?.price === 'number' ? body.price : null;

    return {
      title: body?.title ?? null,
      imageUrl: body?.pictures?.[0]?.url ?? body?.thumbnail ?? null,
      price,
      currency: price !== null ? body?.currency_id ?? 'BRL' : null,
      source: 'mercadolivre-api',
    };
  }

  private logTokenProblem(error: unknown): void {
    if (error instanceof MercadoLivreAuthError) {
      // Só o código do erro — nunca token. "invalid_grant" e "not_connected"
      // pedem ação humana: refazer /auth/mercadolivre/connect.
      this.logger.error(
        `Token do Mercado Livre indisponível (${error.code}). O preview do ML segue ` +
          'só com preenchimento manual até alguém refazer GET /auth/mercadolivre/connect.',
      );
    } else {
      this.logger.warn(`Falha ao obter token do Mercado Livre: ${(error as Error).message}`);
    }
  }

  private empty(): ProductMetadata {
    return { title: null, imageUrl: null, price: null, currency: null, source: null };
  }
}
