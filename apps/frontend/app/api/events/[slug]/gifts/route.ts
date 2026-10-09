import { proxyToBackend } from '../../../../../lib/backend-proxy';

// POST /api/events/:slug/gifts  → cria o presente (Sprint 3, Dia 4)
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json();
  return proxyToBackend(`/events/${slug}/gifts`, { method: 'POST', body });
}

// GET /api/events/:slug/gifts   → lista os presentes do evento
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return proxyToBackend(`/events/${slug}/gifts`, { method: 'GET' });
}
