import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './[...path]/route';

const origin = 'http://localhost:3100';
function context(path: string) {
  return { params: Promise.resolve({ path: path.split('/') }) };
}
describe('demo builder proxy boundary', () => {
  beforeEach(() => {
    vi.stubEnv('RENAISS_API_URL', 'https://upstream.example');
    // Format examples, not real keys.
    vi.stubEnv('RENAISS_BUILDER_API_KEY', 'rnbldr_live_fixture');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('forwards only the server builder credential, and strips upstream secrets', async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(init);
        return Response.json(
          { offers: [] },
          {
            headers: {
              'set-cookie': 'private=secret',
              'x-builder-api-key': 'rnbldr_live_fixture',
            },
          },
        );
      }),
    );
    const response = await GET(
      new Request(`${origin}/api/renaiss/v2/gacha/buyback/offers`, {
        headers: {
          'x-builder-api-key': 'rnbldr_live_other',
          cookie: 'browser=session',
          authorization: 'Bearer ignored',
        },
      }),
      context('v2/gacha/buyback/offers'),
    );
    const headers = new Headers(calls[0]?.headers);
    expect(headers.get('x-builder-api-key')).toBe('rnbldr_live_fixture');
    expect(headers.has('cookie')).toBe(false);
    expect(headers.has('authorization')).toBe(false);
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.has('x-builder-api-key')).toBe(false);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('does not attach the builder credential to public catalog reads', async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(init);
        return Response.json({ cardPacks: [] });
      }),
    );
    await GET(
      new Request(`${origin}/api/renaiss/v2/gacha/packs`),
      context('v2/gacha/packs'),
    );
    expect(new Headers(calls[0]?.headers).has('x-builder-api-key')).toBe(false);
  });
  it('forwards public marketplace collectible reads without the builder credential', async () => {
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push([url, init]);
        return Response.json({});
      }),
    );
    for (const path of [
      'v2/marketplace',
      'v2/marketplace/collectibles/1',
      'v2/marketplace/collectibles/1/orders',
    ]) {
      const response = await GET(
        new Request(`${origin}/api/renaiss/${path}`),
        context(path),
      );
      expect(response.status).toBe(200);
      const [url, init] = calls.at(-1) ?? [];
      expect(String(url)).toContain(`/${path}`);
      expect(new Headers(init?.headers).has('x-builder-api-key')).toBe(false);
    }
  });
  it('rejects cross-origin writes, unknown paths, traversal and oversized bodies before forwarding', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const path = 'v2/gacha/pull/stream';
    const request = (body: string, requestOrigin = origin) =>
      new Request(`${origin}/api/renaiss/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: requestOrigin },
        body,
      });
    expect(
      (await POST(request('{}', 'https://other.example'), context(path)))
        .status,
    ).toBe(403);
    expect(
      (await POST(request('{}'), context('v1/wallets/safe-deployment'))).status,
    ).toBe(404);
    expect(
      (await POST(request('{}'), context('v2/gacha/../admin'))).status,
    ).toBe(400);
    expect((await POST(request('x'.repeat(16385)), context(path))).status).toBe(
      413,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the browser-facing host when Next normalizes a loopback URL', async () => {
    const fetch = vi.fn(async () => Response.json({ challengeId: 'fixture' }));
    vi.stubGlobal('fetch', fetch);
    const path = 'v2/auth/wallet/nonce';
    function request(requestOrigin: string) {
      return new Request(`${origin}/api/renaiss/${path}`, {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3100',
          origin: requestOrigin,
          'content-type': 'application/json',
          'sec-fetch-site': 'same-origin',
          'x-forwarded-host': 'untrusted.example',
        },
        body: '{}',
      });
    }
    expect(
      (await POST(request('http://127.0.0.1:3100'), context(path))).status,
    ).toBe(200);
    expect(
      (await POST(request('http://untrusted.example'), context(path))).status,
    ).toBe(403);
    expect(
      (await POST(request('http://127.0.0.1:3101'), context(path))).status,
    ).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects matching hostile Host and Origin before using the builder key', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const path = 'v2/gacha/buyback/offers';
    for (const headers of [
      new Headers({
        host: 'attacker.example:3100',
        origin: 'http://attacker.example:3100',
      }),
      new Headers({ host: 'attacker.example:3100' }),
    ]) {
      const response = await GET(
        new Request(`${origin}/api/renaiss/${path}`, { headers }),
        context(path),
      );
      expect(response.status).toBe(403);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requires an explicit origin allowlist for a hosted demo', async () => {
    const fetch = vi.fn(async () => Response.json({ offers: [] }));
    vi.stubGlobal('fetch', fetch);
    const path = 'v2/gacha/buyback/offers';
    const request = () =>
      new Request(`https://partner.example/api/renaiss/${path}`, {
        headers: { host: 'partner.example', origin: 'https://partner.example' },
      });
    expect((await GET(request(), context(path))).status).toBe(403);
    vi.stubEnv('DEMO_ALLOWED_ORIGINS', 'https://partner.example');
    expect((await GET(request(), context(path))).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('returns the live SSE stream without buffering until completion', async () => {
    let source: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        source = controller;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(stream, {
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
    );
    const response = await POST(
      new Request(`${origin}/api/renaiss/v2/gacha/pull/stream`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      context('v2/gacha/pull/stream'),
    );
    const reader = response.body?.getReader();
    source?.enqueue(new TextEncoder().encode('event: payment_confirmed\n\n'));
    expect(new TextDecoder().decode((await reader?.read())?.value)).toContain(
      'payment_confirmed',
    );
    await reader?.cancel();
  });
  it('forwards wallet access tokens only to private redemption routes', async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(init);
        return Response.json({});
      }),
    );
    for (const path of [
      'v2/redeem/collectibles',
      'v2/redeem/orders',
      `v2/redeem/orders/0x${'aa'.repeat(32)}`,
    ]) {
      const response = await GET(
        new Request(`${origin}/api/renaiss/${path}`, {
          headers: {
            authorization: 'Bearer rnws_at_fixture',
            cookie: 'private=secret',
            'x-builder-api-key': 'rnbldr_live_other',
          },
        }),
        context(path),
      );
      expect(response.status).toBe(200);
      const headers = new Headers(calls.at(-1)?.headers);
      expect(headers.get('authorization')).toBe('Bearer rnws_at_fixture');
      expect(headers.get('x-builder-api-key')).toBe('rnbldr_live_fixture');
      expect(headers.has('cookie')).toBe(false);
    }
  });
  it('does not forward removed or renamed routes', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const path of [
      'v2/marketplace/config',
      'v2/redeem/config',
      'v2/redeem/cards',
      'v2/marketplace/cards/1',
      'v2/marketplace/cards/1/orders',
    ]) {
      const response = await GET(
        new Request(`${origin}/api/renaiss/${path}`),
        context(path),
      );
      expect(response.status).toBe(404);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects missing/wrong wallet credentials before private forwarding', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const bearer of ['', 'Bearer oauth_token', 'Bearer rnws_rt_fixture']) {
      expect(
        (
          await GET(
            new Request(`${origin}/api/renaiss/v2/redeem/orders`, {
              headers: { authorization: bearer },
            }),
            context('v2/redeem/orders'),
          )
        ).status,
      ).toBe(401);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('supports bodyless authorized tracking refresh and rejects cross-origin reads', async () => {
    const fetch = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetch);
    const path = `v2/redeem/orders/0x${'aa'.repeat(32)}/tracking`;
    expect(
      (
        await POST(
          new Request(`${origin}/api/renaiss/${path}`, {
            method: 'POST',
            headers: { authorization: 'Bearer rnws_at_fixture' },
          }),
          context(path),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await GET(
          new Request(`${origin}/api/renaiss/v2/redeem/collectibles`, {
            headers: {
              origin: 'https://other.example',
              authorization: 'Bearer rnws_at_fixture',
            },
          }),
          context('v2/redeem/collectibles'),
        )
      ).status,
    ).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
