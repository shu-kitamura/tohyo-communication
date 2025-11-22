import { NextRequest } from 'next/server';
import { getCloudflareContext } from "@opennextjs/cloudflare";

// GET /vote/:sessionId/stream - SSE for real-time updates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { env } = await getCloudflareContext();
  const id = env.VOTE_SESSION.idFromName(sessionId);
  const stub = env.VOTE_SESSION.get(id);

  return stub.fetch("http://do/stream");
}
