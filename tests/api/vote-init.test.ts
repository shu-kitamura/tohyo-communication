import { POST } from '@/app/api/vote/route';
import { createRequest } from '@/tests/helpers/request';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { v4 as uuidv4 } from 'uuid';

jest.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: jest.fn(),
}));
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

const mockGetCloudflareContext =
  getCloudflareContext as jest.Mock;
const mockUuid = uuidv4 as jest.Mock;

const buildEnv = (stub: { fetch: jest.Mock }) => ({
  VOTE_SESSION: {
    idFromName: jest.fn(() => 'id'),
    get: jest.fn(() => stub),
  },
});

describe('POST /api/vote', () => {
  beforeEach(() => {
    mockUuid.mockReturnValue('test-session-id');
  });

  it('INIT-01: 単一選択でセッション作成できる', async () => {
    const session = {
      sessionId: 'test-session-id',
      question: 'Q',
      voteType: 'single',
      choices: [
        { choiceId: '1', text: 'A', voteCount: 0 },
        { choiceId: '2', text: 'B', voteCount: 0 },
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify(session), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest('http://localhost/api/vote', {
      method: 'POST',
      body: {
        question: 'Q',
        voteType: 'single',
        choices: [{ text: 'A' }, { text: 'B' }],
      },
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.sessionId).toBe('test-session-id');
    expect(data.voteUrl).toBe(
      'http://localhost/vote/test-session-id'
    );
    expect(data.createdAt).toBeTruthy();
  });

  it('INIT-02: 複数選択でセッション作成できる', async () => {
    const session = {
      sessionId: 'test-session-id',
      question: 'Q',
      voteType: 'multiple',
      choices: [
        { choiceId: '1', text: 'A', voteCount: 0 },
        { choiceId: '2', text: 'B', voteCount: 0 },
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify(session), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest('http://localhost/api/vote', {
      method: 'POST',
      body: {
        question: 'Q',
        voteType: 'multiple',
        choices: [{ text: 'A' }, { text: 'B' }],
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('INIT-03: questionが空なら400', async () => {
    const req = createRequest('http://localhost/api/vote', {
      method: 'POST',
      body: {
        question: ' ',
        voteType: 'single',
        choices: [{ text: 'A' }, { text: 'B' }],
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('INIT-04: choicesが1件以下なら400', async () => {
    const req = createRequest('http://localhost/api/vote', {
      method: 'POST',
      body: {
        question: 'Q',
        voteType: 'single',
        choices: [{ text: 'A' }],
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('INIT-05: choicesが11件以上なら400', async () => {
    const req = createRequest('http://localhost/api/vote', {
      method: 'POST',
      body: {
        question: 'Q',
        voteType: 'single',
        choices: Array.from({ length: 11 }).map((_, i) => ({
          text: `C${i}`,
        })),
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('INIT-06: voteTypeが不正なら400', async () => {
    const req = createRequest('http://localhost/api/vote', {
      method: 'POST',
      body: {
        question: 'Q',
        voteType: 'invalid',
        choices: [{ text: 'A' }, { text: 'B' }],
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('INIT-07: DO初期化失敗で500', async () => {
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

    const req = createRequest('http://localhost/api/vote', {
      method: 'POST',
      body: {
        question: 'Q',
        voteType: 'single',
        choices: [{ text: 'A' }, { text: 'B' }],
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
