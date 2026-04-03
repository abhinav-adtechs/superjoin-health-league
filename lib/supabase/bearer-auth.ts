/** Optional JWT from `Authorization: Bearer <token>` for Route Handlers (cookie-less sessions). */
export function getBearerAccessToken(request: Request): string | undefined {
  const h = request.headers.get('Authorization');
  const m = h?.match(/^Bearer\s+(.+)$/i);
  const t = m?.[1]?.trim();
  return t || undefined;
}
