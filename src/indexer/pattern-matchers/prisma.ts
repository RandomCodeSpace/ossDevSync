import fs from 'fs';
import path from 'path';
import { addNode, addEdgeBetween, getGraph } from '../../core/graph';

export function matchPrismaSchemas(projectPath: string): void {
  const schemaPath = path.join(projectPath, 'prisma', 'schema.prisma');

  if (!fs.existsSync(schemaPath)) return;

  try {
    const content = fs.readFileSync(schemaPath, 'utf-8');
    const models = parsePrismaModels(content);

    for (const model of models) {
      const schemaNode = addNode('schema', model.name, schemaPath, {
        source: 'prisma',
        fields: model.fields,
        relations: model.relations,
      });

      // Link to modules that reference this model
      linkSchemaToModules(schemaNode.id, model.name);
    }
  } catch {
    // skip
  }
}

interface PrismaModel {
  name: string;
  fields: Array<{ name: string; type: string; isRelation: boolean }>;
  relations: string[];
}

function parsePrismaModels(content: string): PrismaModel[] {
  const models: PrismaModel[] = [];
  const modelPattern = /model\s+(\w+)\s*\{([^}]+)\}/g;

  let match;
  while ((match = modelPattern.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];

    const fields: PrismaModel['fields'] = [];
    const relations: string[] = [];

    const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('@@'));

    for (const line of lines) {
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?\s*/);
      if (fieldMatch) {
        const [, fieldName, fieldType, isArray] = fieldMatch;
        const isRelation = fieldType[0] === fieldType[0].toUpperCase() && !['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt', 'Decimal', 'Bytes'].includes(fieldType);

        fields.push({ name: fieldName, type: fieldType + (isArray || ''), isRelation });

        if (isRelation) {
          relations.push(fieldType);
        }
      }
    }

    models.push({ name: modelName, fields, relations });
  }

  return models;
}

function linkSchemaToModules(schemaNodeId: string, modelName: string): void {
  const graph = getGraph();

  graph.forEachNode((nodeId, attrs) => {
    if (attrs.type !== 'module') return;
    if (!attrs.path) return;

    const modulePath = attrs.path as string;
    try {
      const files = fs.readdirSync(modulePath, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile() || !/\.(ts|js|tsx|jsx)$/.test(file.name)) continue;

        const content = fs.readFileSync(path.join(modulePath, file.name), 'utf-8');
        if (content.includes(modelName)) {
          addEdgeBetween(nodeId, schemaNodeId, 'uses_schema');
          return; // one edge per module
        }
      }
    } catch {
      // skip
    }
  });
}
