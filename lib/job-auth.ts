import { timingSafeEqual } from 'node:crypto';

export function requireScanJobToken(request: Request) {
  const configured = process.env.SCAN_JOB_TOKEN;
  if (!configured) throw new Error('SCAN_JOB_TOKEN ist nicht konfiguriert.');

  const authorization = request.headers.get('authorization') ?? '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    throw new Error('Nicht autorisierter Scan-Aufruf.');
  }
}
