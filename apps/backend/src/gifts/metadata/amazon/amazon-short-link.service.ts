import { Injectable, Logger } from '@nestjs/common';
import { MicrolinkService } from '../microlink/microlink.service';
import { canonicalAmazonUrl, isAmazonProductHost, isAmazonShortLink } from './amazon-url';

const MAX_HOPS = 4;
const TIMEOUT_MS = 5_000;

// Cabeçalhos de navegador: o encurtador da Amazon costuma recusar clientes
// que "não parecem" um navegador.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

// Transforma um link encurtado (https://a.co/d/xxxx) no link completo do
// produto (https://www.amazon.com.br/dp/ASIN). Duas camadas:
//
// 1. Seguir os redirects na mão (grátis e rápido). SEGURANÇA: só fazemos
//    requisição pra hosts de encurtador da Amazon, e cada "Location" é
//    validado antes de seguir — se um redirect apontar pra qualquer outro
//    lugar, abortamos. Assim o backend nunca vira um "busca qualquer URL".
// 2. Se a Amazon bloquear (há relatos de que ela barra esse tipo de
//    resolução automática), pedimos pro Microlink abrir o link num navegador
//    de verdade e devolver a URL final.
//
// Devolve null se nenhuma camada conseguiu — quem chama avisa o dono pra
// colar o link completo. Nunca lança exceção.
@Injectable()
export class AmazonShortLinkService {
  private readonly logger = new Logger(AmazonShortLinkService.name);

  constructor(private readonly microlink: MicrolinkService) {}

  async resolve(shortUrl: string): Promise<string | null> {
    const viaRedirect = await this.followRedirects(shortUrl);
    if (viaRedirect) {
      this.logger.log('Link encurtado da Amazon resolvido via redirect direto.');
      return viaRedirect;
    }

    const finalUrl = await this.microlink.fetchFinalUrl(shortUrl);
    const canonical = finalUrl ? canonicalAmazonUrl(finalUrl) : null;
    if (canonical) {
      this.logger.log('Link encurtado da Amazon resolvido via Microlink.');
      return canonical;
    }

    this.logger.warn('Não consegui resolver o link encurtado da Amazon por nenhuma camada.');
    return null;
  }

  private async followRedirects(startUrl: string): Promise<string | null> {
    let current = startUrl;

    for (let hop = 0; hop < MAX_HOPS; hop++) {
      let hostname: string;
      try {
        hostname = new URL(current).hostname.toLowerCase();
      } catch {
        return null;
      }

      // Chegou numa página de produto da Amazon: terminou.
      if (isAmazonProductHost(hostname)) return canonicalAmazonUrl(current);

      // Qualquer coisa que não seja encurtador da Amazon: não segue.
      if (!isAmazonShortLink(current)) return null;

      let response: Response;
      try {
        response = await fetch(current, {
          redirect: 'manual',
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        this.logger.warn(`Redirect direto falhou: ${(error as Error).message}`);
        return null;
      }

      try {
        await response.body?.cancel();
      } catch {
        // só liberando a conexão; não importa se falhar
      }

      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location) {
        this.logger.warn(`Encurtador respondeu ${response.status} sem redirect utilizável.`);
        return null;
      }

      try {
        current = new URL(location, current).toString();
      } catch {
        return null;
      }
    }

    return null;
  }
}
