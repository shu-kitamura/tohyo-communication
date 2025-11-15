import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { ExportJsonResponse } from '@/lib/types';

// GET /vote/:sessionId/export - Export results
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

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    if (!format) {
      return NextResponse.json(
        { error: 'formatパラメータが必要です' },
        { status: 400 }
      );
    }

    const totalVotes = session.choices.reduce((sum, choice) => sum + choice.voteCount, 0);
    const choicesWithPercentage = session.choices.map((choice) => ({
      text: choice.text,
      voteCount: choice.voteCount,
      percentage: totalVotes > 0 ? Math.round((choice.voteCount / totalVotes) * 1000) / 10 : 0,
    }));

    if (format === 'json') {
      const response: ExportJsonResponse = {
        sessionId: session.sessionId,
        question: session.question,
        voteType: session.voteType,
        totalVotes,
        choices: choicesWithPercentage,
        exportedAt: new Date().toISOString(),
      };
      return NextResponse.json(response);
    }

    if (format === 'csv') {
      const csvRows = [
        '選択肢,得票数,得票率',
        ...choicesWithPercentage.map(
          (choice) => `${choice.text},${choice.voteCount},${choice.percentage}%`
        ),
      ];
      const csv = csvRows.join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="vote-results-${sessionId}.csv"`,
        },
      });
    }

    if (format === 'image') {
      // For now, return a not implemented error
      // Image export would require server-side canvas or screenshot library
      return NextResponse.json(
        { error: '画像エクスポートは未実装です' },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { error: '無効なformatです。json, csv, imageのいずれかを指定してください' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error exporting results:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
