import { proxyToBackend } from '../../../../../../lib/backend-proxy';

// PATCH /api/events/:slug/gifts/:giftId → edita título, preço, link ou imagem
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; giftId: string }> },
) {
  const { slug, giftId } = await params;
  const body = await request.json();
  return proxyToBackend(`/events/${slug}/gifts/${giftId}`, { method: 'PATCH', body });
}
