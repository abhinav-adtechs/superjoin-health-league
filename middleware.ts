import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
  'capacitor://localhost',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
];

export function middleware(request: NextRequest) {
  const origin = request.headers.get('Origin') ?? '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
  const res = NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/api') && (origin || request.method === 'OPTIONS')) {
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    if (isAllowed) {
      res.headers.set('Access-Control-Allow-Origin', origin);
    }
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: res.headers });
    }
  }
  return res;
}

export const config = { matcher: '/api/:path*' };
