import { insertChangeSpec, getPendingChangeSpecs, getChangeSpec, updateChangeSpecStatus } from '../core/db';
import type { ChangeSpec, ChangeAction, ChangeStatus } from '../types';
import { createChangeSpec } from './spec';

export class ChangeQueue {
  enqueue(
    action: ChangeAction,
    description: string,
    source: ChangeSpec['source'],
    target: ChangeSpec['target'],
    affectedModules: string[] = [],
    impact: ChangeSpec['impact'] = { filesAffected: 0, importsToUpdate: 0 }
  ): ChangeSpec {
    const spec = createChangeSpec(action, description, source, target, affectedModules, impact);
    insertChangeSpec(spec);
    return spec;
  }

  getPending(): ChangeSpec[] {
    return getPendingChangeSpecs();
  }

  get(id: string): ChangeSpec | undefined {
    return getChangeSpec(id);
  }

  approve(id: string): void {
    updateChangeSpecStatus(id, 'approved');
  }

  reject(id: string): void {
    updateChangeSpecStatus(id, 'rejected');
  }

  markInProgress(id: string): void {
    updateChangeSpecStatus(id, 'in_progress');
  }

  complete(id: string): void {
    updateChangeSpecStatus(id, 'completed');
  }

  updateStatus(id: string, status: ChangeStatus): void {
    updateChangeSpecStatus(id, status);
  }
}

// Singleton
let queue: ChangeQueue | null = null;

export function getChangeQueue(): ChangeQueue {
  if (!queue) {
    queue = new ChangeQueue();
  }
  return queue;
}
