import { forwardGuestRequest } from '../../../../../../../lib/guest-proxy';

// GET /api/events/:slug/contributions/:contributionId/payment
// Reabre os dados de pagamento Pix de uma cota pendente da própria sessão.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; contributionId: string }> },
) {
  const { slug, contributionId } = await params;
  return forwardGuestRequest(
    slug,
    `/guest/contributions/${encodeURIComponent(contributionId)}/payment`,
    'GET',
  );
}
