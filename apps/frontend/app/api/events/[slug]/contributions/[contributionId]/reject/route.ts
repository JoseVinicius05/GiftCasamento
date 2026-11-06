import { proxyToBackend } from '../../../../../../../lib/backend-proxy';

// POST /api/events/:slug/contributions/:contributionId/reject
// DONO diz "não recebi": a cota pendente vira expirada e o valor volta a ficar disponível.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string; contributionId: string }> },
) {
  const { slug, contributionId } = await params;

  return proxyToBackend(
    `/events/${encodeURIComponent(slug)}/contributions/${encodeURIComponent(contributionId)}/reject`,
    { method: 'POST', body: {} },
  );
}
