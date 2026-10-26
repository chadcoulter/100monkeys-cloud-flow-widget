export const nodeTypes = [
  'architecture',
  'capability',
  'component',
  'function',
  'application',
  'research',
  'evidence',
  'governance',
] as const;
export type CloudNode = {
  id: string;
  type: (typeof nodeTypes)[number];
  label: string;
  description?: string;
  maturity?: string;
  sourceRefs?: string[];
  metadata?: Record<string, unknown>;
};
export type CloudEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  contribution?: string;
  status?: 'documented' | 'proposed' | 'validated';
  sourceRefs?: string[];
};
export type CloudFlowDocument = { schemaVersion: '1.0'; nodes: CloudNode[]; edges: CloudEdge[] };
export type GraphIndex = {
  document: CloudFlowDocument;
  nodes: Map<string, CloudNode>;
  edges: Map<string, CloudEdge>;
  outgoing: Map<string, CloudEdge[]>;
  incoming: Map<string, CloudEdge[]>;
};
export const relationshipLabels: Record<string, [string, string]> = {
  contains: ['contains', 'contained by'],
  contributes_to: ['contributes to', 'receives contribution from'],
  depends_on: ['depends on', 'dependency of'],
  implements: ['implements', 'implemented by'],
  uses: ['uses', 'used by'],
  transforms: ['transforms', 'transformed by'],
  resolves: ['resolves', 'resolved by'],
  governs: ['governs', 'governed by'],
  derived_from: ['derived from', 'source of'],
  related_to: ['related to', 'related to'],
  validated_by: ['validated by', 'validates'],
};
export function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected an object`);
  return value as Record<string, unknown>;
}
export function nonempty(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path}: expected a nonempty string`);
}
export function parseDocument(input: unknown): CloudFlowDocument {
  const doc = record(input, 'document');
  if (doc.schemaVersion !== '1.0') throw new Error('document.schemaVersion: expected "1.0"');
  if (!Array.isArray(doc.nodes) || !doc.nodes.length) throw new Error('document.nodes: expected a nonempty array');
  if (!Array.isArray(doc.edges)) throw new Error('document.edges: expected an array');
  const ids = new Set<string>();
  doc.nodes.forEach((value, i) => {
    const n = record(value, `nodes[${i}]`);
    nonempty(n.id, `nodes[${i}].id`);
    nonempty(n.label, `nodes[${i}].label`);
    if (ids.has(n.id)) throw new Error(`nodes[${i}].id: duplicate node ID "${n.id}"`);
    ids.add(n.id);
    if (!nodeTypes.includes(n.type as CloudNode['type'])) throw new Error(`nodes[${i}].type: unknown node type`);
    optionalStrings(n, ['description', 'maturity'], `nodes[${i}]`);
    sourceRefs(n, `nodes[${i}]`);
    if (n.metadata !== undefined) record(n.metadata, `nodes[${i}].metadata`);
  });
  const edgeIds = new Set<string>();
  doc.edges.forEach((value, i) => {
    const e = record(value, `edges[${i}]`);
    for (const key of ['id', 'source', 'target', 'type']) nonempty(e[key], `edges[${i}].${key}`);
    if (edgeIds.has(e.id as string)) throw new Error(`edges[${i}].id: duplicate edge ID "${e.id}"`);
    edgeIds.add(e.id as string);
    for (const key of ['source', 'target'])
      if (!ids.has(e[key] as string)) throw new Error(`edges[${i}].${key}: missing node "${e[key]}"`);
    if (e.status !== undefined && !['documented', 'proposed', 'validated'].includes(e.status as string))
      throw new Error(`edges[${i}].status: invalid status`);
    optionalStrings(e, ['contribution'], `edges[${i}]`);
    sourceRefs(e, `edges[${i}]`);
  });
  return structuredClone(doc) as CloudFlowDocument;
}
function optionalStrings(obj: Record<string, unknown>, keys: string[], path: string) {
  for (const key of keys)
    if (obj[key] !== undefined && typeof obj[key] !== 'string') throw new Error(`${path}.${key}: expected a string`);
}
function sourceRefs(obj: Record<string, unknown>, path: string) {
  if (
    obj.sourceRefs !== undefined &&
    (!Array.isArray(obj.sourceRefs) || obj.sourceRefs.some((x) => typeof x !== 'string'))
  )
    throw new Error(`${path}.sourceRefs: expected an array of strings`);
}
export function indexGraph(input: unknown): GraphIndex {
  const document = parseDocument(input);
  const nodes = new Map(document.nodes.map((n) => [n.id, n]));
  const edges = new Map(document.edges.map((e) => [e.id, e]));
  const outgoing = new Map(document.nodes.map((n) => [n.id, [] as CloudEdge[]]));
  const incoming = new Map(document.nodes.map((n) => [n.id, [] as CloudEdge[]]));
  for (const e of document.edges) {
    outgoing.get(e.source)!.push(e);
    incoming.get(e.target)!.push(e);
  }
  return { document, nodes, edges, outgoing, incoming };
}
