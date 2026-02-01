import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// POST /vote/:sessionId/close - Close voting session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const { env } = await getCloudflareContext();
    const id = env.VOTE_SESSION.idFromName(sessionId);
    const stub = env.VOTE_SESSION.get(id);

    const doRes = await stub.fetch("http://do/close", {
      method: "POST",
    });

    if (!doRes.ok) {
      if (doRes.status === 404) {
        return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
      }
      return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
    }

    const data = (await doRes.json()) as {
      closedAt: string;
    };

    return NextResponse.json({
      sessionId,
      status: "closed",
      closedAt: data.closedAt,
    });
  } catch (error) {
    console.error("Error closing session:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
