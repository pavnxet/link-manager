import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { POST } from './route.ts';

// @ts-expect-error - Mocked module via loader
import { cookieStore } from 'next/headers';

describe('POST /api/auth/login', () => {
  let originalEnv: NodeJS.ProcessEnv;

  before(() => {
    originalEnv = { ...process.env };
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'password';
  });

  after(() => {
    process.env = originalEnv;
  });

  test('should return 401 for invalid credentials', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 401);

    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.message, 'Invalid credentials');
  });

  test('should return 200 and set cookie for valid credentials', async () => {
    // Reset mocks
    cookieStore.set.mock.resetCalls();

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);

    // Verify cookie set
    assert.strictEqual(cookieStore.set.mock.callCount(), 1);
    const [name, value, options] = cookieStore.set.mock.calls[0].arguments;
    assert.strictEqual(name, 'auth-token');
    assert.ok(value !== 'authenticated' && value.length > 0); // Check that a token is set
    assert.strictEqual(options.httpOnly, true);
    assert.strictEqual(options.path, '/');
  });

  test('should return 500 if env vars are missing', async () => {
    delete process.env.ADMIN_USERNAME;

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 500);

    // Restore env
    process.env.ADMIN_USERNAME = 'admin';
  });
});

describe('POST /api/auth/login rate limiting', () => {
  test('blocks after five attempts from the same client', async () => {
    process.env.ADMIN_USERNAME = 'admin'
    process.env.ADMIN_PASSWORD = 'password'

    const attempt = () =>
      POST(
        new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.77' },
          body: JSON.stringify({ username: 'admin', password: 'wrong' }),
        }),
      )

    const statuses: number[] = []
    for (let i = 0; i < 6; i += 1) statuses.push((await attempt()).status)

    assert.deepStrictEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401])
    assert.strictEqual(statuses[5], 429, 'the sixth attempt must be rate limited')

    const res = await attempt()
    assert.strictEqual(res.status, 429)
    assert.ok(Number(res.headers.get('retry-after')) > 0, 'Retry-After should be set')
    assert.match((await res.json()).message, /Too many attempts/)
  })
})
