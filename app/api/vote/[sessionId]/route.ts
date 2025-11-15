import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { store } from '@/lib/store';
import { GetSessionResponse, SubmitVoteRequest, SubmitVoteResponse } from '@/lib/types';

const VOTER_TOKEN_COOKIE = 'voter_token';

// GET /vote/:sessionId - Get session info
export async function GET(
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

    const cookieStore = await cookies();
    const voterToken = cookieStore.get(VOTER_TOKEN_COOKIE)?.value || '';
    const hasVoted = store.hasVoted(sessionId, voterToken);

    if (session.status === 'closed') {
      const response: GetSessionResponse = {
        sessionId: session.sessionId,
        question: session.question,
        voteType: session.voteType,
        choices: session.choices.map(({ choiceId, text }) => ({ choiceId, text })),
        status: session.status,
        canVote: false,
        message: '投票は終了しました',
      };
      return NextResponse.json(response);
    }

    if (hasVoted) {
      const response: GetSessionResponse = {
        sessionId: session.sessionId,
        question: session.question,
        voteType: session.voteType,
        choices: session.choices.map(({ choiceId, text }) => ({ choiceId, text })),
        status: session.status,
        canVote: false,
        message: '既に投票済みです',
      };
      return NextResponse.json(response);
    }

    const response: GetSessionResponse = {
      sessionId: session.sessionId,
      question: session.question,
      voteType: session.voteType,
      choices: session.choices.map(({ choiceId, text }) => ({ choiceId, text })),
      status: session.status,
      canVote: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// POST /vote/:sessionId - Submit vote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body: SubmitVoteRequest = await request.json();

    const session = store.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    if (session.status === 'closed') {
      return NextResponse.json(
        { error: '投票は終了しました' },
        { status: 403 }
      );
    }

    // Check if already voted
    const cookieStore = await cookies();
    let voterToken = cookieStore.get(VOTER_TOKEN_COOKIE)?.value || '';

    if (voterToken && store.hasVoted(sessionId, voterToken)) {
      return NextResponse.json(
        { error: '既に投票済みです' },
        { status: 409 }
      );
    }

    // Validation
    if (!body.choiceIds || body.choiceIds.length === 0) {
      return NextResponse.json(
        { error: '選択肢を選んでください' },
        { status: 400 }
      );
    }

    if (session.voteType === 'single' && body.choiceIds.length > 1) {
      return NextResponse.json(
        { error: '単一選択の投票では1つだけ選択してください' },
        { status: 400 }
      );
    }

    // Check if all choice IDs are valid
    const validChoiceIds = session.choices.map((c) => c.choiceId);
    const invalidChoices = body.choiceIds.filter((id) => !validChoiceIds.includes(id));
    if (invalidChoices.length > 0) {
      return NextResponse.json(
        { error: '無効な選択肢が含まれています' },
        { status: 400 }
      );
    }

    // Generate voter token if not exists
    if (!voterToken) {
      voterToken = `voter_${uuidv4()}`;
    }

    // Record vote
    const vote = {
      voterToken,
      sessionId,
      choiceIds: body.choiceIds,
      votedAt: new Date(),
    };

    store.addVote(vote);

    // Update vote counts
    const updatedChoices = session.choices.map((choice) => {
      if (body.choiceIds.includes(choice.choiceId)) {
        return { ...choice, voteCount: choice.voteCount + 1 };
      }
      return choice;
    });

    const updatedSession = { ...session, choices: updatedChoices };
    store.updateSession(sessionId, updatedSession);

    const votedAt = new Date();
    const response: SubmitVoteResponse = {
      message: '投票が完了しました',
      votedAt: votedAt.toISOString(),
    };

    const res = NextResponse.json(response, { status: 201 });
    
    // Set cookie
    res.cookies.set(VOTER_TOKEN_COOKIE, voterToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 86400, // 24 hours
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Error submitting vote:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
