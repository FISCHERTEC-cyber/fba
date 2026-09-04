import { timingSafeEqual } from 'node:crypto';

export function requireScanJobToken(request: Request) {
  requireJobToken(request, 'SCAN_JOB_TOKEN');
}

export function requireNotificationJobToken(request: Request) {
  requireJobToken(request, 'NOTIFICATION_JOB_TOKEN');
}

function requireJobToken(request: Request, environmentKey: 'SCAN_JOB_TOKEN' | 'NOTIFICATION_JOB_TOKEN') {
  const configured = process.env[environmentKey];
  if (!configured) throw new Error(`${environmentKey} ist nicht konfiguriert.`);

  const authorization = request.headers.get('authorization') ?? '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    throw new Error('Nicht autorisierter Scan-Aufruf.');
  }
}
