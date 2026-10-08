// Testa manualmente o mesmo fluxo que o MercadoLivreTokenService faz
// automaticamente: usa o refresh_token já salvo no banco pra pedir um
// access_token novo ao Mercado Livre, sem precisar reautorizar pelo
// navegador de novo.
//
// IMPORTANTE: o token foi salvo no banco de PRODUÇÃO (Neon), já que a
// autorização foi feita direto em giftcasamento.onrender.com. Rodem esse
// script com a DATABASE_URL apontando pro Neon, não pro Postgres local.
//
// Uso: node refresh-mercadolivre-token.mjs

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stored = await prisma.mercadoLivreToken.findFirst();

  if (!stored) {
    console.log('Nenhum token encontrado no banco. Rode /auth/mercadolivre/connect primeiro.');
    return;
  }

  console.log('Token atual expira em:', stored.expiresAt.toISOString());
  console.log('Pedindo refresh...\n');

  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.MERCADOLIVRE_CLIENT_ID ?? '',
      client_secret: process.env.MERCADOLIVRE_CLIENT_SECRET ?? '',
      refresh_token: stored.refreshToken,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.log('❌ Falha no refresh, status:', response.status);
    console.log(JSON.stringify(data, null, 2));
    if (data.error === 'invalid_grant') {
      console.log('\ninvalid_grant: o refresh_token não serve mais — precisa reautorizar pelo navegador (/connect).');
    }
    return;
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.mercadoLivreToken.update({
    where: { id: stored.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token, // rotativo: o antigo já não serve mais
      expiresAt,
    },
  });

  console.log('✅ Refresh OK! Novo token salvo no banco, válido até', expiresAt.toISOString());
  console.log('access_token novo:', data.access_token);
}

main()
  .catch((err) => console.error('Erro:', err))
  .finally(() => prisma.$disconnect());
