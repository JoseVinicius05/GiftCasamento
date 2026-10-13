import { forwardGuestPost } from '../../../../../../../lib/guest-proxy';

// POST /api/events/:slug/gifts/:giftId/contributions  { amount }
// Proxy da reserva de cota do CONVIDADO (ver lib/guest-proxy.ts).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; giftId: string }> },
) {
  const { slug, giftId } = await params;
  return forwardGuestPost(request, slug, `/guest/gifts/${encodeURIComponent(giftId)}/contributions`);
}
