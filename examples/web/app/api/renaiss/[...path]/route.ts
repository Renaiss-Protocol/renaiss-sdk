/** Demo-only builder backend. Production integrators must authenticate their own users here. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const publicReads =
  /^v2\/gacha\/packs(?:\/[^/]+(?:\/content|\/pull-history)?)?$/;
const privateReads = new Set([
  'v2/gacha/draw-status',
  'v2/gacha/pull-history',
  'v2/gacha/buyback/offers',
]);
const redemptionReads =
  /^v2\/redeem\/(?:collectibles|regions|orders(?:\/0x[\da-fA-F]{64})?|checkout\/[\da-fA-F-]{36})$/;
const redemptionTracking = /^v2\/redeem\/orders\/0x[\da-fA-F]{64}\/tracking$/;
const writes = new Set([
  'v2/auth/wallet/nonce',
  'v2/auth/wallet/verify',
  'v2/auth/wallet/refresh',
  'v2/auth/wallet/revoke',
  'v2/redeem/address/validate',
  'v2/redeem/quotes',
  'v2/redeem/checkout/prepare',
  'v2/redeem/checkout',
  'v2/gacha/pull/prepare',
  'v2/gacha/pull/stream',
  'v2/gacha/buyback',
  ...[
    'asks/prepare',
    'asks',
    'bids/prepare',
    'bids',
    'buy/prepare',
    'buy',
    'sell/prepare',
    'sell',
    'orders/cancel/prepare',
    'orders/cancel',
  ].map((path) => `v2/marketplace/${path}`),
]);

type Context = { params: Promise<{ path: string[] }> };
async function forward(request: Request, context: Context): Promise<Response> {
  const { path: segments } = await context.params;
  if (segments.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)))
    return new Response('Invalid path', { status: 400 });
  const path = segments.join('/');
  const isPublic =
    request.method === 'GET' &&
    (publicReads.test(path) ||
      /^v2\/marketplace(?:\/collectibles\/\d+(?:\/orders)?)?$/.test(path));
  if (
    !(
      isPublic ||
      (request.method === 'GET' &&
        (privateReads.has(path) || redemptionReads.test(path))) ||
      (request.method === 'POST' &&
        (writes.has(path) || redemptionTracking.test(path)))
    )
  )
    return new Response('Not found', { status: 404 });
  const url = new URL(request.url);
  // Next normalizes loopback request URLs to localhost in development. The
  // Host header still identifies the origin the browser actually requested.
  const host = request.headers.get('host');
  const requestOrigin = host ? `${url.protocol}//${host}` : url.origin;
  const origin = request.headers.get('origin');
  // A caller-controlled Host alone is not trust: DNS rebinding can make both
  // Host and Origin agree on an attacker domain. Hosted demos must opt in to
  // their exact origins; local development accepts loopback only.
  const port = url.port ? `:${url.port}` : '';
  const allowedOrigins = process.env.DEMO_ALLOWED_ORIGINS
    ? process.env.DEMO_ALLOWED_ORIGINS.split(',').map((value) => value.trim())
    : [`http://localhost${port}`, `http://127.0.0.1${port}`];
  if (
    !allowedOrigins.includes(requestOrigin) ||
    (origin &&
      (!allowedOrigins.includes(origin) || origin !== requestOrigin)) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return new Response('Cross-origin requests are not supported', {
      status: 403,
    });
  const baseUrl = process.env.RENAISS_API_URL;
  const key = process.env.RENAISS_BUILDER_API_KEY;
  if (!baseUrl || (!isPublic && !key))
    return Response.json(
      {
        code: 'DEMO_NOT_CONFIGURED',
        error: 'Set RENAISS_API_URL and RENAISS_BUILDER_API_KEY on the server.',
      },
      { status: 503 },
    );
  const headers = new Headers({
    accept: path.endsWith('/stream') ? 'text/event-stream' : 'application/json',
  });
  if (!isPublic && key) headers.set('x-builder-api-key', key);
  if (!isPublic && path.startsWith('v2/redeem/')) {
    const bearer = request.headers.get('authorization');
    if (
      !bearer ||
      !/^Bearer rnws_at_[A-Za-z0-9_-]+$/.test(bearer) ||
      bearer.length > 140
    )
      return new Response('Wallet access token required', { status: 401 });
    headers.set('authorization', bearer);
  }
  let body: string | undefined;
  if (request.method === 'POST' && !redemptionTracking.test(path)) {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return new Response('Expected JSON', { status: 415 });
    const reader = request.body?.getReader();
    if (!reader) return new Response('Missing body', { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16 * 1024) {
          await reader.cancel();
          return new Response('Body too large', { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    body = await new Blob(chunks as BlobPart[]).text();
    headers.set('content-type', 'application/json');
  }
  try {
    const upstream = await fetch(
      `${baseUrl.replace(/\/$/, '')}/${path}${url.search}`,
      {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
        signal: request.signal,
        redirect: 'error',
      },
    );
    // Pass the stream through immediately, preserving payment recovery events.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'private, no-store',
        'x-accel-buffering': 'no',
      },
    });
  } catch {
    return Response.json(
      {
        code: 'UPSTREAM_UNAVAILABLE',
        error:
          'API connection interrupted. Reconcile any submitted trade or pull before trying again.',
      },
      { status: 502 },
    );
  }
}
export const GET = forward;
export const POST = forward;
