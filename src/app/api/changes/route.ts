import { NextRequest, NextResponse } from 'next/server';
import { getPendingChangeSpecs, getChangeSpec, insertChangeSpec, updateChangeSpecStatus, ensureDb } from '../../../core/db';
import { createChangeSpec } from '../../../changes/spec';
import type { ChangeAction } from '../../../types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const specId = searchParams.get('id');

  try {
    await ensureDb();
    if (specId) {
      const spec = getChangeSpec(specId);
      if (!spec) {
        return NextResponse.json({ error: 'Change spec not found' }, { status: 404 });
      }
      return NextResponse.json(spec);
    }

    const specs = getPendingChangeSpecs();
    return NextResponse.json({ count: specs.length, changes: specs });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDb();
    const body = await request.json();
    const { action, description, source, target, affectedModules, impact } = body;

    if (!action || !description) {
      return NextResponse.json({ error: 'action and description are required' }, { status: 400 });
    }

    const spec = createChangeSpec(
      action as ChangeAction,
      description,
      source || {},
      target || {},
      affectedModules || [],
      impact || { filesAffected: 0, importsToUpdate: 0 }
    );

    insertChangeSpec(spec);

    return NextResponse.json(spec, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureDb();
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const spec = getChangeSpec(id);
    if (!spec) {
      return NextResponse.json({ error: 'Change spec not found' }, { status: 404 });
    }

    updateChangeSpecStatus(id, status);

    return NextResponse.json({ success: true, id, status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
