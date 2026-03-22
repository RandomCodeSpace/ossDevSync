import { NextRequest, NextResponse } from 'next/server';
import { exportGraph, getNodeData, getNeighbors, getNodeEdges, getStats } from '../../../core/graph';
import { ensureDb } from '../../../core/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get('nodeId');
  const action = searchParams.get('action');

  try {
    const project = searchParams.get('project');
    await ensureDb(project || undefined);
    if (action === 'stats') {
      return NextResponse.json(getStats());
    }

    if (action === 'neighbors' && nodeId) {
      const direction = (searchParams.get('direction') || 'both') as 'in' | 'out' | 'both';
      const neighbors = getNeighbors(nodeId, direction);
      const edges = getNodeEdges(nodeId, direction);
      return NextResponse.json({ neighbors, edges });
    }

    if (nodeId) {
      const node = getNodeData(nodeId);
      if (!node) {
        return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      }
      const edges = getNodeEdges(nodeId);
      return NextResponse.json({ node, edges });
    }

    // Return full graph
    const { nodes, edges } = exportGraph();
    return NextResponse.json({ nodes, edges });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
