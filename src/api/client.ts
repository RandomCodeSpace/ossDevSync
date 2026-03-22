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

function projectParam(projectPath?: string, prefix: '?' | '&' = '?'): string {
  return projectPath ? `${prefix}project=${encodeURIComponent(projectPath)}` : '';
}

// Graph API
export async function fetchGraph(projectPath?: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  return fetchJson(`${BASE_URL}/graph${projectParam(projectPath)}`);
}

export async function fetchNodeDetails(nodeId: string, projectPath?: string): Promise<{ node: GraphNode; edges: GraphEdge[] }> {
  return fetchJson(`${BASE_URL}/graph?nodeId=${nodeId}${projectParam(projectPath, '&')}`);
}

export async function fetchNeighbors(nodeId: string, direction: 'in' | 'out' | 'both' = 'both', projectPath?: string) {
  return fetchJson<{ neighbors: GraphNode[]; edges: GraphEdge[] }>(
    `${BASE_URL}/graph?nodeId=${nodeId}&action=neighbors&direction=${direction}${projectParam(projectPath, '&')}`
  );
}

export async function fetchStats(projectPath?: string) {
  return fetchJson<{ nodeCount: number; edgeCount: number; nodesByType: Record<string, number> }>(
    `${BASE_URL}/graph?action=stats${projectParam(projectPath, '&')}`
  );
}

// Docs API
export async function fetchDocs(projectPath?: string): Promise<{ count: number; docs: DocEntry[] }> {
  return fetchJson(`${BASE_URL}/docs${projectParam(projectPath)}`);
}

export async function fetchDoc(moduleId: string, projectPath?: string): Promise<DocEntry> {
  return fetchJson(`${BASE_URL}/docs?moduleId=${moduleId}${projectParam(projectPath, '&')}`);
}

export async function updateDoc(moduleId: string, content: string, projectPath?: string): Promise<void> {
  await fetchJson(`${BASE_URL}/docs`, {
    method: 'PUT',
    body: JSON.stringify({ moduleId, content, project: projectPath }),
  });
}

// Changes API
export async function fetchPendingChanges(projectPath?: string): Promise<{ count: number; changes: ChangeSpec[] }> {
  return fetchJson(`${BASE_URL}/changes${projectParam(projectPath)}`);
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
  impact?: ChangeSpec['impact'],
  projectPath?: string
): Promise<ChangeSpec> {
  return fetchJson(`${BASE_URL}/changes`, {
    method: 'POST',
    body: JSON.stringify({ action, description, source, target, affectedModules, impact, project: projectPath }),
  });
}

export async function updateChangeStatus(id: string, status: string, projectPath?: string): Promise<void> {
  await fetchJson(`${BASE_URL}/changes`, {
    method: 'PATCH',
    body: JSON.stringify({ id, status, project: projectPath }),
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
    body: JSON.stringify({ path: projectPath, incremental, watch, project: projectPath }),
  });
}

export async function stopWatcher(): Promise<void> {
  await fetchJson(`${BASE_URL}/index`, { method: 'DELETE' });
}

// Projects API
export async function fetchProjects(): Promise<{ projects: string[] }> {
  return fetchJson(`${BASE_URL}/projects`);
}
