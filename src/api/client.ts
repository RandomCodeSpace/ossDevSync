import type { GraphNode, GraphEdge, ChangeSpec, DocEntry, ChangeAction } from '../types';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }
  return res.json();
}

// Graph API
export async function fetchGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  return fetchJson(`${BASE_URL}/graph`);
}

export async function fetchNodeDetails(nodeId: string): Promise<{ node: GraphNode; edges: GraphEdge[] }> {
  return fetchJson(`${BASE_URL}/graph?nodeId=${nodeId}`);
}

export async function fetchNeighbors(nodeId: string, direction: 'in' | 'out' | 'both' = 'both') {
  return fetchJson<{ neighbors: GraphNode[]; edges: GraphEdge[] }>(
    `${BASE_URL}/graph?nodeId=${nodeId}&action=neighbors&direction=${direction}`
  );
}

export async function fetchStats() {
  return fetchJson<{ nodeCount: number; edgeCount: number; nodesByType: Record<string, number> }>(
    `${BASE_URL}/graph?action=stats`
  );
}

// Docs API
export async function fetchDocs(): Promise<{ count: number; docs: DocEntry[] }> {
  return fetchJson(`${BASE_URL}/docs`);
}

export async function fetchDoc(moduleId: string): Promise<DocEntry> {
  return fetchJson(`${BASE_URL}/docs?moduleId=${moduleId}`);
}

export async function updateDoc(moduleId: string, content: string): Promise<void> {
  await fetchJson(`${BASE_URL}/docs`, {
    method: 'PUT',
    body: JSON.stringify({ moduleId, content }),
  });
}

// Changes API
export async function fetchPendingChanges(): Promise<{ count: number; changes: ChangeSpec[] }> {
  return fetchJson(`${BASE_URL}/changes`);
}

export async function fetchChangeSpec(id: string): Promise<ChangeSpec> {
  return fetchJson(`${BASE_URL}/changes?id=${id}`);
}

export async function createChange(
  action: ChangeAction,
  description: string,
  source: ChangeSpec['source'],
  target: ChangeSpec['target'],
  affectedModules?: string[],
  impact?: ChangeSpec['impact']
): Promise<ChangeSpec> {
  return fetchJson(`${BASE_URL}/changes`, {
    method: 'POST',
    body: JSON.stringify({ action, description, source, target, affectedModules, impact }),
  });
}

export async function updateChangeStatus(id: string, status: string): Promise<void> {
  await fetchJson(`${BASE_URL}/changes`, {
    method: 'PATCH',
    body: JSON.stringify({ id, status }),
  });
}

// Index API
export async function triggerIndex(projectPath: string, incremental = false, watch = true) {
  return fetchJson<{
    success: boolean;
    projectPath: string;
    nodeCount: number;
    edgeCount: number;
    duration: number;
    watching: boolean;
  }>(`${BASE_URL}/index`, {
    method: 'POST',
    body: JSON.stringify({ path: projectPath, incremental, watch }),
  });
}

export async function stopWatcher(): Promise<void> {
  await fetchJson(`${BASE_URL}/index`, { method: 'DELETE' });
}
