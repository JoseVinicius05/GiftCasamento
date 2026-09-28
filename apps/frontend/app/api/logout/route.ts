import { NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '../login/route';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(TOKEN_COOKIE);
  return response;
}
