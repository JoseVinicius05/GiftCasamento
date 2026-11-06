import { proxyToBackend } from '../../../../../../../lib/backend-proxy';

// POST /api/events/:slug/contributions/:contributionId/confirm
// DONO confirma que o Pix caiu. Corpo opcional: { acceptExpired: true } ("Recebi mesmo assim").
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; contributionId: string }> },
) {
  const { slug, contributionId } = await params;
  const body = (await request.json().catch(() => ({}))) as { acceptExpired?: unknown } | null;

  return proxyToBackend(
    `/events/${encodeURIComponent(slug)}/contributions/${encodeURIComponent(contributionId)}/confirm`,
    // Só repassa o flag, e só como booleano de verdade.
    { method: 'POST', body: body?.acceptExpired === true ? { acceptExpired: true } : {} },
  );
}
