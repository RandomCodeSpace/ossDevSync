import { getGraph, getNodeData, getNeighbors, getNodeEdges } from './graph';
import { upsertDoc, getDoc } from './db';
import type { GraphNode } from '../types';

export function generateDocs(): void {
  const graph = getGraph();

  graph.forEachNode((nodeId, attrs) => {
    if (attrs.type !== 'module') return;

    // Skip manually edited docs
    const existing = getDoc(nodeId);
    if (existing?.isManuallyEdited) return;

    const node = getNodeData(nodeId);
    if (!node) return;

    const content = generateModuleDoc(node);

    upsertDoc({
      moduleId: nodeId,
      content,
      generatedAt: Date.now(),
      isManuallyEdited: false,
    });
  });
}

function generateModuleDoc(node: GraphNode): string {
  const lines: string[] = [];

  lines.push(`# ${node.name}`);
  lines.push('');
  lines.push(`**Type:** ${node.properties.moduleType || 'module'}`);
  lines.push(`**Path:** \`${node.path}\``);
  lines.push('');

  // Dependencies (modules this one imports)
  const outEdges = getNodeEdges(node.id, 'out');

  // Children (contained modules/entries)
  const children = getNeighbors(node.id, 'out')
    .filter(n => {
      return outEdges.some(e => e.targetId === n.id && e.type === 'contains');
    });

  if (children.length > 0) {
    lines.push('## Contents');
    lines.push('');
    for (const child of children) {
      lines.push(`- **${child.name}** (${child.type})`);
    }
    lines.push('');
  }
  const imports = outEdges.filter(e => e.type === 'imports');

  if (imports.length > 0) {
    lines.push('## Dependencies');
    lines.push('');
    for (const edge of imports) {
      const target = getNodeData(edge.targetId);
      if (target) {
        lines.push(`- \`${target.name}\` (${target.type})`);
      }
    }
    lines.push('');
  }

  // Dependents (modules that import this one)
  const inEdges = getNodeEdges(node.id, 'in');
  const dependents = inEdges.filter(e => e.type === 'imports');

  if (dependents.length > 0) {
    lines.push('## Used By');
    lines.push('');
    for (const edge of dependents) {
      const source = getNodeData(edge.sourceId);
      if (source) {
        lines.push(`- \`${source.name}\` (${source.type})`);
      }
    }
    lines.push('');
  }

  // APIs exposed
  const apis = outEdges.filter(e => e.type === 'exposes');
  if (apis.length > 0) {
    lines.push('## APIs Exposed');
    lines.push('');
    for (const edge of apis) {
      const api = getNodeData(edge.targetId);
      if (api) {
        const method = api.properties.method || 'ALL';
        const apiPath = api.properties.path || api.name;
        lines.push(`- \`${method} ${apiPath}\``);
      }
    }
    lines.push('');
  }

  // APIs consumed
  const consumed = outEdges.filter(e => e.type === 'consumes');
  if (consumed.length > 0) {
    lines.push('## APIs Consumed');
    lines.push('');
    for (const edge of consumed) {
      const api = getNodeData(edge.targetId);
      if (api) {
        lines.push(`- \`${api.name}\``);
      }
    }
    lines.push('');
  }

  // Schemas used
  const schemas = outEdges.filter(e => e.type === 'uses_schema');
  if (schemas.length > 0) {
    lines.push('## Schemas');
    lines.push('');
    for (const edge of schemas) {
      const schema = getNodeData(edge.targetId);
      if (schema) {
        const source = schema.properties.source || 'unknown';
        lines.push(`- **${schema.name}** (${source})`);
      }
    }
    lines.push('');
  }

  // Config
  const configs = outEdges.filter(e => e.type === 'configured_by');
  if (configs.length > 0) {
    lines.push('## Configuration');
    lines.push('');
    for (const edge of configs) {
      const config = getNodeData(edge.targetId);
      if (config) {
        lines.push(`- \`${config.name}\` (${config.properties.format || 'text'})`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
