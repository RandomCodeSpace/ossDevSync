import { v4 as uuidv4 } from 'uuid';
import type { ChangeSpec, ChangeAction } from '../types';

export function createChangeSpec(
  action: ChangeAction,
  description: string,
  source: ChangeSpec['source'],
  target: ChangeSpec['target'],
  affectedModules: string[] = [],
  impact: ChangeSpec['impact'] = { filesAffected: 0, importsToUpdate: 0 }
): ChangeSpec {
  return {
    id: `cs_${uuidv4().slice(0, 12)}`,
    type: 'architecture_change',
    action,
    description,
    source,
    target,
    affectedModules,
    impact,
    status: 'pending_approval',
    createdAt: new Date().toISOString(),
  };
}

export function describeChange(spec: ChangeSpec): string {
  switch (spec.action) {
    case 'move_module':
      return `Move module from ${spec.source.path} to ${spec.target.path}`;
    case 'split_module':
      return `Split module ${spec.source.moduleId} into separate modules`;
    case 'merge_modules':
      return `Merge module ${spec.source.moduleId} into ${spec.target.moduleId}`;
    case 'add_dependency':
      return `Add dependency from ${spec.source.moduleId} to ${spec.target.moduleId}`;
    case 'remove_dependency':
      return `Remove dependency from ${spec.source.moduleId} to ${spec.target.moduleId}`;
    case 'rename_module':
      return `Rename module ${spec.source.moduleId}`;
    case 'update_docs':
      return `Update documentation for ${spec.source.moduleId}`;
    case 'update_api':
      return `Update API ${spec.source.moduleId}`;
    case 'update_schema':
      return `Update schema ${spec.source.moduleId}`;
    default:
      return spec.description;
  }
}
