import { NextRequest, NextResponse } from 'next/server';
import { indexProject } from '../../../core/indexer';
import { generateDocs } from '../../../core/doc-generator';
import { startWatching, stopWatching, isWatching } from '../../../core/watcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: projectPath, incremental, watch } = body;

    if (!projectPath) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const result = await indexProject(projectPath, incremental ?? false);

    // Generate docs after indexing
    generateDocs();

    // Start file watcher if requested
    if (watch) {
      startWatching(projectPath);
    }

    return NextResponse.json({
      success: true,
      ...result,
      watching: isWatching(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    stopWatching();
    return NextResponse.json({ success: true, message: 'File watcher stopped' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
