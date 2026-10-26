export const nodeTypes = [
  'page',
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
  content?: string;
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
export type WikiStackDefinition = {
  id: string;
  title: string;
  anchorPageId: string;
  orientation: 'horizontal' | 'vertical';
  side: 'top' | 'bottom' | 'left' | 'right';
  expanded?: boolean;
  members: Array<{ pageId: string } | { stackId: string }>;
};
export type WikiDocument = {
  format: 'wiki-stacks';
  schemaVersion: '1.0';
  title: string;
  startPageId: string;
  pages: Array<{
    id: string;
    title: string;
    summary?: string;
    content: string;
    sourceRefs?: string[];
    links?: Array<{ target: string; label?: string }>;
  }>;
  stacks: WikiStackDefinition[];
};
export type CloudFlowDocument = {
  schemaVersion: '1.0';
  nodes: CloudNode[];
  edges: CloudEdge[];
  presentation?: { kind: 'wiki'; title: string; startNodeId: string; stacks: WikiStackDefinition[] };
};
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
  if (doc.format === 'wiki-stacks') return parseWikiDocument(input);
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
    optionalStrings(n, ['description', 'content', 'maturity'], `nodes[${i}]`);
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
  if (doc.presentation !== undefined) {
    const p = record(doc.presentation, 'presentation');
    if (p.kind !== 'wiki') throw new Error('presentation.kind: expected wiki');
    nonempty(p.title, 'presentation.title');
    if (!ids.has(p.startNodeId as string)) throw new Error('presentation.startNodeId: missing page');
    validateWikiStacks(p.stacks, ids);
  }
  return structuredClone(doc) as CloudFlowDocument;
}

export function parseWikiDocument(input: unknown): CloudFlowDocument {
  const doc = record(input, 'wiki');
  if (doc.format !== 'wiki-stacks' || doc.schemaVersion !== '1.0')
    throw new Error('wiki: expected format "wiki-stacks" and schemaVersion "1.0"');
  nonempty(doc.title, 'wiki.title');
  nonempty(doc.startPageId, 'wiki.startPageId');
  if (!Array.isArray(doc.pages) || !doc.pages.length) throw new Error('wiki.pages: expected a nonempty array');
  const nodes: CloudNode[] = doc.pages.map((value, i) => {
    const p = record(value, `pages[${i}]`);
    nonempty(p.id, `pages[${i}].id`);
    nonempty(p.title, `pages[${i}].title`);
    if (typeof p.content !== 'string') throw new Error(`pages[${i}].content: expected wiki text`);
    optionalStrings(p, ['summary'], `pages[${i}]`);
    sourceRefs(p, `pages[${i}]`);
    return {
      id: p.id,
      label: p.title,
      type: 'page',
      content: p.content,
      description: p.summary as string | undefined,
      sourceRefs: p.sourceRefs as string[] | undefined,
    };
  });
  const ids = new Set(nodes.map((p) => p.id));
  if (ids.size !== nodes.length) throw new Error('wiki.pages: duplicate page ID');
  if (!ids.has(doc.startPageId)) throw new Error('wiki.startPageId: missing page');
  const edges: CloudEdge[] = [];
  doc.pages.forEach((value, i) => {
    const p = record(value, `pages[${i}]`);
    const links = p.links ?? [];
    if (!Array.isArray(links)) throw new Error(`pages[${i}].links: expected an array`);
    const targets = new Map<string, string>();
    for (const value of links) {
      const link = record(value, `pages[${i}].links`);
      nonempty(link.target, `pages[${i}].links.target`);
      optionalStrings(link, ['label'], `pages[${i}].links`);
      targets.set(link.target, (link.label as string) ?? '');
    }
    for (const match of (p.content as string).matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g))
      if (!targets.has(match[1])) targets.set(match[1], '');
    for (const [target, label] of targets) {
      if (!ids.has(target)) throw new Error(`pages[${i}].links: missing page "${target}"`);
      edges.push({
        id: `wiki:${encodeURIComponent(p.id as string)}:${encodeURIComponent(target)}`,
        source: p.id as string,
        target,
        type: 'related_to',
        contribution: label || undefined,
      });
    }
  });
  validateWikiStacks(doc.stacks, ids);
  return parseDocument({
    schemaVersion: '1.0',
    nodes,
    edges,
    presentation: { kind: 'wiki', title: doc.title, startNodeId: doc.startPageId, stacks: doc.stacks },
  });
}

function validateWikiStacks(input: unknown, pages: Set<string>) {
  if (!Array.isArray(input)) throw new Error('wiki.stacks: expected an array');
  const stacks = new Map<string, Record<string, unknown>>();
  input.forEach((value, i) => {
    const s = record(value, `stacks[${i}]`);
    nonempty(s.id, `stacks[${i}].id`);
    nonempty(s.title, `stacks[${i}].title`);
    if (stacks.has(s.id)) throw new Error(`stacks[${i}]: duplicate stack ID`);
    stacks.set(s.id, s);
    if (!pages.has(s.anchorPageId as string)) throw new Error(`stacks[${i}].anchorPageId: missing page`);
    if (
      !['horizontal', 'vertical'].includes(s.orientation as string) ||
      !['top', 'bottom', 'left', 'right'].includes(s.side as string)
    )
      throw new Error(`stacks[${i}]: invalid orientation or side`);
    if (s.expanded !== undefined && typeof s.expanded !== 'boolean')
      throw new Error(`stacks[${i}].expanded: expected boolean`);
    if (!Array.isArray(s.members)) throw new Error(`stacks[${i}].members: expected an array`);
  });
  const complete = new Set<string>();
  function visit(id: string, path: Set<string>) {
    if (path.has(id)) throw new Error(`wiki.stacks: cyclic nesting at "${id}"`);
    if (complete.has(id)) return;
    const s = stacks.get(id)!;
    const next = new Set([...path, id]);
    for (const value of s.members as unknown[]) {
      const m = record(value, `stacks.${id}.members`);
      if (typeof m.pageId === 'string' && m.stackId === undefined) {
        if (!pages.has(m.pageId)) throw new Error(`stacks.${id}: missing page "${m.pageId}"`);
      } else if (typeof m.stackId === 'string' && m.pageId === undefined) {
        const child = stacks.get(m.stackId);
        if (!child) throw new Error(`stacks.${id}: missing stack "${m.stackId}"`);
        if (child.anchorPageId !== s.anchorPageId)
          throw new Error(`stacks.${id}: nested stack must have the same anchor page`);
        visit(m.stackId, next);
      } else throw new Error(`stacks.${id}: member must reference one pageId or stackId`);
    }
    complete.add(id);
  }
  for (const id of stacks.keys()) visit(id, new Set());
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
