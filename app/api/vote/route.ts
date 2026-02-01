import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CreateSessionRequest, CreateSessionResponse, Session } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();

    // Validation
    if (!body.question || body.question.trim().length === 0) {
      return NextResponse.json({ error: "質問を入力してください" }, { status: 400 });
    }

    if (!body.choices || body.choices.length < 2) {
      return NextResponse.json({ error: "選択肢は2つ以上必要です" }, { status: 400 });
    }

    if (body.choices.length > 10) {
      return NextResponse.json({ error: "選択肢は10個までです" }, { status: 400 });
    }

    // INIT-08: 選択肢のtextが空/空白の場合は不正
    if (body.choices.some((c) => !c.text || c.text.trim().length === 0)) {
      return NextResponse.json({ error: "選択肢のテキストを入力してください" }, { status: 400 });
    }

    if (body.voteType !== "single" && body.voteType !== "multiple") {
      return NextResponse.json(
        {
          error: "投票形式はsingleまたはmultipleを指定してください",
        },
        { status: 400 },
      );
    }

    // Create session via Durable Object
    const sessionId = uuidv4();
    const { env } = await getCloudflareContext();
    const id = env.VOTE_SESSION.idFromName(sessionId);
    const stub = env.VOTE_SESSION.get(id);

    const initResponse = await stub.fetch("http://do/init", {
      method: "POST",
      body: JSON.stringify({ ...body, sessionId }),
      headers: { "Content-Type": "application/json" },
    });

    if (!initResponse.ok) {
      throw new Error("Failed to initialize session in Durable Object");
    }

    const session = (await initResponse.json()) as Session;

    const baseUrl = request.nextUrl.origin;
    const response: CreateSessionResponse = {
      sessionId,
      voteUrl: `${baseUrl}/vote/${sessionId}`,
      createdAt: session.createdAt as unknown as string,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
