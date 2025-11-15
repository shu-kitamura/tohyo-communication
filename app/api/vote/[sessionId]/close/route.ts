import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

// POST /vote/:sessionId/close - Close voting session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const session = store.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    const closedAt = new Date();
    const updatedSession = {
      ...session,
      status: 'closed' as const,
      closedAt,
    };

    store.updateSession(sessionId, updatedSession);

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
