import { NextRequest } from 'next/server';
import { store } from '@/lib/store';

// GET /vote/:sessionId/stream - SSE for real-time updates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = store.getSession(sessionId);

  if (!session) {
    return new Response(
      JSON.stringify({ error: 'セッションが見つかりません' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial data
      const initialData = {
        event: 'init',
        data: {
          sessionId: session.sessionId,
          question: session.question,
          choices: session.choices,
          status: session.status,
        },
      };

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`)
      );

      // Poll for updates every second
      const interval = setInterval(() => {
        const currentSession = store.getSession(sessionId);

        if (!currentSession) {
          controller.close();
          clearInterval(interval);
          return;
        }

        // Send current vote counts
        const updateData = {
          event: 'update',
          data: {
            choices: currentSession.choices,
            status: currentSession.status,
          },
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(updateData)}\n\n`)
        );

        // Close stream if session is closed
        if (currentSession.status === 'closed') {
          const closedData = {
            event: 'closed',
            data: { message: '投票が終了しました' },
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(closedData)}\n\n`)
          );

          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
