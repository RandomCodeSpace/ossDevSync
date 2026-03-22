import { NextResponse } from 'next/server';
import { ensureDb } from '../../../core/db';

export async function GET() {
  try {
    await ensureDb();
    const { getDb } = await import('../../../core/db');
    const database = getDb();

    // Get all distinct project paths from nodes table
    const stmt = database.prepare('SELECT DISTINCT project_path FROM nodes WHERE project_path != \'\' ORDER BY project_path');
    const projects: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      projects.push(row.project_path as string);
    }
    stmt.free();

    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
