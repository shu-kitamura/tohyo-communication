import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SubmitVoteRequest, SubmitVoteResponse } from "@/lib/types";

const VOTER_TOKEN_COOKIE = "voter_token";

// GET /vote/:sessionId - Get session info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const { env } = await getCloudflareContext();
    const id = env.VOTE_SESSION.idFromName(sessionId);
    const stub = env.VOTE_SESSION.get(id);

    const cookieStore = await cookies();
    const voterToken = cookieStore.get(VOTER_TOKEN_COOKIE)?.value || "";

    const url = new URL("http://do/");
    if (voterToken) {
      url.searchParams.set("voterToken", voterToken);
    }

    const doRes = await stub.fetch(url.toString());

    if (!doRes.ok) {
      if (doRes.status === 404) {
        return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
      }
      return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
    }

    const data = await doRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error getting session:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// POST /vote/:sessionId - Submit vote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body: SubmitVoteRequest = await request.json();
    const { env } = await getCloudflareContext();
    const id = env.VOTE_SESSION.idFromName(sessionId);
    const stub = env.VOTE_SESSION.get(id);

    // Check if already voted
    const cookieStore = await cookies();
    let voterToken = cookieStore.get(VOTER_TOKEN_COOKIE)?.value || "";

    // Generate voter token if not exists
    if (!voterToken) {
      voterToken = `voter_${uuidv4()}`;
    }

    const doRes = await stub.fetch("http://do/vote", {
      method: "POST",
      body: JSON.stringify({ ...body, voterToken }),
      headers: { "Content-Type": "application/json" },
    });

    const data = (await doRes.json()) as {
      message: string;
    };

    if (!doRes.ok) {
      return NextResponse.json(data, {
        status: doRes.status,
      });
    }

    const response: SubmitVoteResponse = {
      message: data.message,
      votedAt: new Date().toISOString(),
    };

    const res = NextResponse.json(response, {
      status: 201,
    });

    // Set cookie
    res.cookies.set(VOTER_TOKEN_COOKIE, voterToken, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 86400, // 24 hours
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("Error submitting vote:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
