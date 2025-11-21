import { NextRequest, NextResponse } from 'next/server';
import { createStorageAdapter } from '@/lib/storage-adapter';
import { getCloudflareEnv } from '@/lib/get-cloudflare-env';

// POST /vote/:sessionId/close - Close voting session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const env = getCloudflareEnv(request);
    const storage = createStorageAdapter(env || undefined);
    const session = await storage.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    const closedAt = await storage.closeSession(sessionId);

    return NextResponse.json({
      sessionId,
      status: 'closed',
      closedAt: closedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error closing session:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
