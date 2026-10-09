import { Injectable, Logger } from '@nestjs/common';
import { ProductMetadata } from '../types/product-metadata';
import { discoverCatalogId } from './mercado-livre-redirect';
import { parseMercadoLivreUrl } from './mercado-livre-url';
import { MercadoLivreAuthError, MercadoLivreTokenService } from './mercado-livre-token.service';

const API_BASE = 'https://api.mercadolibre.com';
const TIMEOUT_MS = 8_000;

// Resultado interno de uma chamada à API do ML.
type MlResponse = { status: number; body: any };

// Token em uso nesta consulta. Fica num objeto pra que, se um 401 forçar a
// renovação, as chamadas seguintes da MESMA consulta já usem o token novo.
type TokenContext = { token: string };

const ITEM_ATTRIBUTES = 'id,title,price,currency_id,pictures,thumbnail,catalog_product_id';

// Busca título/imagem/preço de um produto do Mercado Livre.
//
// ESTRATÉGIA (decidida com testes reais, Sprint 3):
//
// 1. CATÁLOGO — GET /products/{productId} (URLs /p/MLB...). É o único
//    caminho confirmado: GET /items/{id} devolve 403 access_denied mesmo
//    com token OAuth válido para anúncios de outros vendedores. Traz título
//    e imagem, mas NÃO o preço (buy_box_winner vem null).
// 2. MULTIGET — GET /items?ids={itemId} (Dia 4). Endpoint diferente do
//    /items/{id}, descrito na documentação do ML. NÃO sabemos se tem a mesma
//    restrição — é uma tentativa barata (1 chamada). Se funcionar, traz até o
//    PREÇO. O log diz qual camada funcionou, pra gente descobrir em produção.
// 3. DESCOBERTA POR REDIRECT — pra links sem /p/MLB (ex: /MLB-123-titulo_JM),
//    pede a página sem seguir o redirect e lê o "Location": se o ML mandar o
//    anúncio pra uma página /p/MLB..., usamos esse ID no catálogo (camada 1).
//
// NÃO usamos Microlink de fallback aqui: pro ML ele devolve só o título e o
// logo genéricos do site ("Mercado Livre"), pior que campo vazio.
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

    const ctx: TokenContext = { token: '' };
    try {
      ctx.token = await this.tokenService.getValidAccessToken();
    } catch (error) {
      this.logTokenProblem(error);
      return this.empty();
    }

    try {
      // Camada 1: catálogo, quando a URL já traz o productId.
      if (productId) {
        const fromCatalog = await this.fetchCatalog(productId, ctx);
        if (fromCatalog) return fromCatalog;
      }

      // Camada 2: multiget pelo itemId (wid ou /MLB-123-...).
      if (itemId) {
        const fromItem = await this.fetchItemMultiget(itemId, ctx);
        if (fromItem) return fromItem;
      }

      // Camada 3: sem catálogo na URL — tenta descobrir pelo redirect da página.
      if (!productId) {
        const discovered = await discoverCatalogId(url);
        if (discovered) {
          this.logger.log(`Catálogo ${discovered} descoberto pelo redirect da página do anúncio.`);
          const fromCatalog = await this.fetchCatalog(discovered, ctx);
          if (fromCatalog) return fromCatalog;
        }
      }

      this.logger.warn(
        'Mercado Livre: nenhuma camada trouxe dados — o dono vai preencher manualmente.',
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

  private async fetchCatalog(productId: string, ctx: TokenContext): Promise<ProductMetadata | null> {
    const response = await this.callApi(`/products/${productId}`, ctx);
    if (response.status === 200) {
      this.logger.log(`ML: dados obtidos pelo catálogo (/products/${productId}).`);
      return this.fromProduct(response.body);
    }
    this.logger.warn(`ML /products/${productId} respondeu ${response.status}.`);
    return null;
  }

  // O multiget devolve uma LISTA: [{ code: 200, body: {...item} }].
  private async fetchItemMultiget(itemId: string, ctx: TokenContext): Promise<ProductMetadata | null> {
    const response = await this.callApi(
      `/items?ids=${itemId}&attributes=${ITEM_ATTRIBUTES}`,
      ctx,
    );

    const entry = Array.isArray(response.body) ? response.body[0] : null;
    if (response.status === 200 && entry?.code === 200 && entry.body) {
      this.logger.log(`ML: dados obtidos pelo multiget (/items?ids=${itemId}).`);
      return this.fromItem(entry.body);
    }

    this.logger.warn(
      `ML multiget de ${itemId} respondeu ${response.status}` +
        `${entry?.code ? ` (item: ${entry.code})` : ''} — esperado se o ML restringir anúncios de terceiros.`,
    );
    return null;
  }

  // Faz o GET autenticado. Se o ML responder 401, renova o token UMA vez e
  // repete UMA vez — nunca em loop. Se o refresh falhar (invalid_grant), o
  // MercadoLivreAuthError sobe pro fetchMetadata, que devolve campos vazios.
  private async callApi(path: string, ctx: TokenContext): Promise<MlResponse> {
    const first = await this.get(path, ctx.token);
    if (first.status !== 401) return first;

    this.logger.warn('ML respondeu 401 — renovando o token e tentando uma única vez de novo.');
    ctx.token = await this.tokenService.forceRefresh(ctx.token);
    return this.get(path, ctx.token);
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
      imageUrl: body?.pictures?.[0]?.secure_url ?? body?.pictures?.[0]?.url ?? body?.thumbnail ?? null,
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
