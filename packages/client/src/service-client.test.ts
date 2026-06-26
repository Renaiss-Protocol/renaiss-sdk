import { describe, expect, it } from 'vitest';
import { ServiceClient } from './service-client';

describe('ServiceClient types', () => {
  it('requires paths from generated OpenAPI bindings', () => {
    const client = new ServiceClient({ baseUrl: 'https://api.test' });

    client.get('/v0/users/me');
    client.post('/api/auth/api-key/create', {
      body: {
        name: 'test key',
      },
    });

    // @ts-expect-error Unknown GET paths must not fall back to Action<unknown>.
    client.get('/not-in-openapi');

    // @ts-expect-error Unknown POST paths must not fall back to Action<unknown>.
    client.post('/not-in-openapi');

    expect(true).toBe(true);
  });
});
