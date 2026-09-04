export function requireUserId(request: Request): string {
  const userId = request.headers.get('x-fba-user-id')?.trim();
  if (!userId) {
    throw new Error('Nutzerkontext fehlt. Für MVP x-fba-user-id setzen; später durch Auth ersetzen.');
  }
  return userId;
}
