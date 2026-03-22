import { getGraph, getNodeData, getImpact as graphGetImpact, getNodeEdges } from '../core/graph';
import type { GraphNode } from '../types';

export interface ImpactReport {
  moduleId: string;
  moduleName: string;
  directDependents: GraphNode[];
  transitiveDependents: GraphNode[];
  filesAffected: number;
  importsToUpdate: number;
}

export function analyzeImpact(moduleId: string): ImpactReport {
  const node = getNodeData(moduleId);
  if (!node) {
    return {
      moduleId,
      moduleName: 'unknown',
      directDependents: [],
      transitiveDependents: [],
      filesAffected: 0,
      importsToUpdate: 0,
    };
  }

  const { affected, depth } = graphGetImpact(moduleId);

  const directDependents = affected.filter(n => depth.get(n.id) === 1);
  const transitiveDependents = affected.filter(n => (depth.get(n.id) ?? 0) > 1);

  // Count import edges that would need updating
  const inEdges = getNodeEdges(moduleId, 'in');
  const importsToUpdate = inEdges.filter(e => e.type === 'imports').length;

  // Estimate files affected (direct dependents + the module itself)
  const filesAffected = directDependents.length + 1;

  return {
    moduleId,
    moduleName: node.name,
    directDependents,
    transitiveDependents,
    filesAffected,
    importsToUpdate,
  };
}

export function analyzeMoveImpact(moduleId: string, targetPath: string): ImpactReport {
  const report = analyzeImpact(moduleId);

  // Moving a module affects all imports pointing to it
  // The number of imports to update is the count of modules that import this one
  return {
    ...report,
    importsToUpdate: report.directDependents.length + report.transitiveDependents.length,
  };
}
