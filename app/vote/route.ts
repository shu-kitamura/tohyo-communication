import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { store } from '@/lib/store';
import { CreateSessionRequest, CreateSessionResponse, Choice } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();

    // Validation
    if (!body.question || body.question.trim().length === 0) {
      return NextResponse.json(
        { error: '質問を入力してください' },
        { status: 400 }
      );
    }

    if (!body.choices || body.choices.length < 2) {
      return NextResponse.json(
        { error: '選択肢は2つ以上必要です' },
        { status: 400 }
      );
    }

    if (body.choices.length > 10) {
      return NextResponse.json(
        { error: '選択肢は10個までです' },
        { status: 400 }
      );
    }

    if (body.voteType !== 'single' && body.voteType !== 'multiple') {
      return NextResponse.json(
        { error: '投票形式はsingleまたはmultipleを指定してください' },
        { status: 400 }
      );
    }

    // Create session
    const sessionId = uuidv4();
    const choices: Choice[] = body.choices.map((choice, index) => ({
      choiceId: String(index + 1),
      text: choice.text.trim(),
      voteCount: 0,
    }));

    const session = {
      sessionId,
      question: body.question.trim(),
      voteType: body.voteType,
      choices,
      status: 'active' as const,
      createdAt: new Date(),
    };

    store.createSession(session);

    const baseUrl = request.nextUrl.origin;
    const response: CreateSessionResponse = {
      sessionId,
      voteUrl: `${baseUrl}/vote/${sessionId}`,
      createdAt: session.createdAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
