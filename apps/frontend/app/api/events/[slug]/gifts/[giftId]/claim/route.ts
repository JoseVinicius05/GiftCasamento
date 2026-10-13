import { forwardGuestPost } from '../../../../../../../lib/guest-proxy';

// POST /api/events/:slug/gifts/:giftId/claim  { method: 'pix' | 'link' }
// Proxy do "presentear por completo" do CONVIDADO (ver lib/guest-proxy.ts).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; giftId: string }> },
) {
  const { slug, giftId } = await params;
  return forwardGuestPost(request, slug, `/guest/gifts/${encodeURIComponent(giftId)}/claim`);
}
