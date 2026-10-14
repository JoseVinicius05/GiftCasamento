import { forwardGuestRequest } from '../../../../../../lib/guest-proxy';

// DELETE /api/events/:slug/contributions/:contributionId
// Cancela uma cota PENDENTE da própria sessão do convidado (vira `expired`).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; contributionId: string }> },
) {
  const { slug, contributionId } = await params;
  return forwardGuestRequest(slug, `/guest/contributions/${encodeURIComponent(contributionId)}`, 'DELETE');
}
