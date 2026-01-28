import { POST } from '@/app/api/vote/[sessionId]/close/route';
import { createRequest } from '@/tests/helpers/request';
import { getCloudflareContext } from '@opennextjs/cloudflare';

jest.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: jest.fn(),
}));

const mockGetCloudflareContext =
  getCloudflareContext as jest.Mock;

const buildEnv = (stub: { fetch: jest.Mock }) => ({
  VOTE_SESSION: {
    idFromName: jest.fn(() => 'id'),
    get: jest.fn(() => stub),
  },
});

describe('POST /api/vote/:sessionId/close', () => {
  it('CLOSE-01: 進行中セッションを終了できる', async () => {
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            closedAt: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest(
      'http://localhost/api/vote/id/close',
      { method: 'POST' }
    );
    const res = await POST(req, {
      params: Promise.resolve({ sessionId: 'id' }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('closed');
    expect(data.closedAt).toBeTruthy();
  });

  it('CLOSE-02: 既に終了済みでも200', async () => {
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            closedAt: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest(
      'http://localhost/api/vote/id/close',
      { method: 'POST' }
    );
    const res = await POST(req, {
      params: Promise.resolve({ sessionId: 'id' }),
    });
    expect(res.status).toBe(200);
  });

  it('CLOSE-03: 存在しないsessionIdは404', async () => {
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest(
      'http://localhost/api/vote/unknown/close',
      { method: 'POST' }
    );
    const res = await POST(req, {
      params: Promise.resolve({
        sessionId: 'unknown',
      }),
    });
    expect(res.status).toBe(404);
  });

  it('CLOSE-04: DO内部エラーは500', async () => {
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest(
      'http://localhost/api/vote/id/close',
      { method: 'POST' }
    );
    const res = await POST(req, {
      params: Promise.resolve({ sessionId: 'id' }),
    });
    expect(res.status).toBe(500);
  });
});
