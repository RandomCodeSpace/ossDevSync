import { NextRequest, NextResponse } from 'next/server';
import { getDoc, getAllDocs, upsertDoc, ensureDb } from '../../../core/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const moduleId = searchParams.get('moduleId');

  try {
    const project = searchParams.get('project');
    await ensureDb(project || undefined);
    if (moduleId) {
      const doc = getDoc(moduleId);
      if (!doc) {
        return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
      }
      return NextResponse.json(doc);
    }

    const docs = getAllDocs();
    return NextResponse.json({ count: docs.length, docs });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    await ensureDb(body.project || undefined);
    const { moduleId, content } = body;

    if (!moduleId || !content) {
      return NextResponse.json({ error: 'moduleId and content are required' }, { status: 400 });
    }

    const existing = getDoc(moduleId);
    const now = Date.now();

    upsertDoc({
      moduleId,
      content,
      generatedAt: existing?.generatedAt ?? now,
      editedAt: now,
      isManuallyEdited: true,
    });

    return NextResponse.json({ success: true, moduleId });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
