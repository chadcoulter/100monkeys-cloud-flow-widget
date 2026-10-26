import { type GraphIndex, nonempty, record, relationshipLabels } from './domain.js';

export type Breadcrumb = {
  id: string;
  previousBreadcrumbId: string | null;
  currentNodeId: string;
  incomingEdgeId: string | null;
  childEdgeIds: string[];
  childBreadcrumbIds: string[];
  arrival: 'start' | 'traverse' | 'search';
  reverse: boolean;
};
export type StackMember =
  | { kind: 'node'; id: string; edgeId: string | null; reverse: boolean }
  | { kind: 'stack'; id: string };
export type CloudStack = {
  id: string;
  parentStackId: string | null;
  anchorNodeId: string;
  anchorEdgeId: string | null;
  anchorBreadcrumbId: string;
  label: string;
  side: 'top' | 'bottom' | 'left' | 'right';
  orientation: 'horizontal' | 'vertical';
  members: StackMember[];
  expanded: boolean;
  bolted: boolean;
};
export type CloudFlowViewState = {
  schemaVersion: '1.0';
  focusNodeId: string;
  breadcrumbHeadId: string;
  activeStackId: string | null;
  stacks: Record<string, CloudStack>;
  breadcrumbs: Record<string, Breadcrumb>;
};
export function createView(graph: GraphIndex, nodeId: string): CloudFlowViewState {
  if (!graph.nodes.has(nodeId)) throw new Error(`Unknown focus node "${nodeId}"`);
  const root: Breadcrumb = {
    id: 'b1',
    previousBreadcrumbId: null,
    currentNodeId: nodeId,
    incomingEdgeId: null,
    childEdgeIds: [],
    childBreadcrumbIds: [],
    arrival: 'start',
    reverse: false,
  };
  const state: CloudFlowViewState = {
    schemaVersion: '1.0',
    focusNodeId: nodeId,
    breadcrumbHeadId: root.id,
    activeStackId: null,
    stacks: {},
    breadcrumbs: { [root.id]: root },
  };
  addRelationshipStacks(graph, state, root);
  return state;
}
function nextId(prefix: string, records: object): string {
  let i = Object.keys(records).length + 1;
  while (Object.hasOwn(records, `${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}
function addRelationshipStacks(graph: GraphIndex, state: CloudFlowViewState, crumb: Breadcrumb) {
  for (const reverse of [false, true]) {
    const edges = (reverse ? graph.incoming : graph.outgoing).get(crumb.currentNodeId)!;
    if (!edges.length) continue;
    const rootId = nextId('s', state.stacks);
    const root: CloudStack = {
      id: rootId,
      parentStackId: null,
      anchorNodeId: crumb.currentNodeId,
      anchorEdgeId: null,
      anchorBreadcrumbId: crumb.id,
      label: reverse ? 'Incoming relationships' : 'Outgoing relationships',
      side: reverse ? 'bottom' : 'top',
      orientation: 'horizontal',
      members: [],
      expanded: true,
      bolted: false,
    };
    state.stacks[root.id] = root;
    for (const type of [...new Set(edges.map((e) => e.type))].sort()) {
      const id = nextId('s', state.stacks);
      state.stacks[id] = {
        ...root,
        id,
        parentStackId: root.id,
        label: relationshipLabels[type]?.[reverse ? 1 : 0] ?? `${reverse ? 'reverse: ' : ''}${type}`,
        orientation: 'vertical',
        expanded: false,
        members: edges
          .filter((e) => e.type === type)
          .map((e) => ({ kind: 'node', id: reverse ? e.source : e.target, edgeId: e.id, reverse })),
      };
      root.members.push({ kind: 'stack', id });
    }
  }
}
export function traverse(
  graph: GraphIndex,
  input: CloudFlowViewState,
  edgeId: string,
  reverse = false
): CloudFlowViewState {
  const edge = graph.edges.get(edgeId);
  if (!edge || (reverse ? edge.target : edge.source) !== input.focusNodeId)
    throw new Error(`Edge "${edgeId}" cannot be traversed from the current focus${reverse ? ' in reverse' : ''}`);
  return arrive(graph, input, reverse ? edge.source : edge.target, edgeId, reverse, 'traverse');
}
export function searchFocus(graph: GraphIndex, input: CloudFlowViewState, nodeId: string): CloudFlowViewState {
  if (!graph.nodes.has(nodeId)) throw new Error(`Unknown search node "${nodeId}"`);
  return arrive(graph, input, nodeId, null, false, 'search');
}
function arrive(
  graph: GraphIndex,
  input: CloudFlowViewState,
  nodeId: string,
  edgeId: string | null,
  reverse: boolean,
  arrival: Breadcrumb['arrival']
) {
  const state = structuredClone(input);
  const parent = state.breadcrumbs[state.breadcrumbHeadId];
  // Reopening an explored branch restores its context, including its nested stacks.
  const existing = parent.childBreadcrumbIds
    .map((id) => state.breadcrumbs[id])
    .find(
      (b) => b.currentNodeId === nodeId && b.incomingEdgeId === edgeId && b.reverse === reverse && b.arrival === arrival
    );
  if (existing) return focusBreadcrumb(state, existing.id);
  const id = nextId('b', state.breadcrumbs);
  const crumb: Breadcrumb = {
    id,
    previousBreadcrumbId: parent.id,
    currentNodeId: nodeId,
    incomingEdgeId: edgeId,
    childEdgeIds: [],
    childBreadcrumbIds: [],
    arrival,
    reverse,
  };
  state.breadcrumbs[id] = crumb;
  parent.childBreadcrumbIds.push(id);
  if (edgeId && !parent.childEdgeIds.includes(edgeId)) parent.childEdgeIds.push(edgeId);
  state.focusNodeId = nodeId;
  state.breadcrumbHeadId = id;
  state.activeStackId = null;
  addRelationshipStacks(graph, state, crumb);
  return state;
}
export function focusBreadcrumb(input: CloudFlowViewState, id: string): CloudFlowViewState {
  const crumb = input.breadcrumbs[id];
  if (!crumb) throw new Error(`Unknown breadcrumb "${id}"`);
  return { ...input, focusNodeId: crumb.currentNodeId, breadcrumbHeadId: id, activeStackId: null };
}
export function back(input: CloudFlowViewState): CloudFlowViewState {
  if (input.activeStackId) return { ...input, activeStackId: null };
  const previous = input.breadcrumbs[input.breadcrumbHeadId].previousBreadcrumbId;
  return previous ? focusBreadcrumb(input, previous) : input;
}
export function breadcrumbPath(state: CloudFlowViewState): Breadcrumb[] {
  const path: Breadcrumb[] = [];
  const visited = new Set<string>();
  let id: string | null = state.breadcrumbHeadId;
  while (id) {
    if (visited.has(id) || !state.breadcrumbs[id])
      throw new Error('Breadcrumb chain contains a cycle or missing reference');
    visited.add(id);
    const b: Breadcrumb = state.breadcrumbs[id];
    path.unshift(b);
    id = b.previousBreadcrumbId;
  }
  return path;
}
export function toggleStack(input: CloudFlowViewState, id: string): CloudFlowViewState {
  if (!input.stacks[id]) throw new Error(`Unknown stack "${id}"`);
  return { ...input, stacks: { ...input.stacks, [id]: { ...input.stacks[id], expanded: !input.stacks[id].expanded } } };
}
export function focusStack(input: CloudFlowViewState, id: string): CloudFlowViewState {
  const stack = input.stacks[id];
  if (!stack) throw new Error(`Unknown stack "${id}"`);
  return { ...focusBreadcrumb(input, stack.anchorBreadcrumbId), activeStackId: id };
}
export function boltStack(
  input: CloudFlowViewState,
  parentStackId: string | null = input.activeStackId
): CloudFlowViewState {
  const state = structuredClone(input);
  const parent = parentStackId ? state.stacks[parentStackId] : null;
  if (parentStackId && (!parent || parent.anchorBreadcrumbId !== state.breadcrumbHeadId))
    throw new Error('Bolt parent must belong to the current breadcrumb');
  const id = nextId('s', state.stacks);
  // A new branch holds references to the current context's relationship groups; domain edges stay untouched.
  const sourceMembers = parent
    ? parent.members
    : Object.values(state.stacks)
        .filter((s) => s.anchorBreadcrumbId === state.breadcrumbHeadId && !s.parentStackId && !s.bolted)
        .flatMap((s) => s.members);
  const root: CloudStack = {
    id,
    parentStackId,
    anchorNodeId: state.focusNodeId,
    anchorEdgeId: null,
    anchorBreadcrumbId: state.breadcrumbHeadId,
    label: `Exploration ${Object.values(state.stacks).filter((s) => s.bolted && s.anchorBreadcrumbId === state.breadcrumbHeadId).length + 1}`,
    side: 'right',
    orientation: parent?.orientation === 'vertical' ? 'horizontal' : 'vertical',
    members: [],
    expanded: true,
    bolted: true,
  };
  state.stacks[id] = root;
  function copyMembers(members: StackMember[], owner: CloudStack): StackMember[] {
    return members.map((m) => {
      if (m.kind === 'node') return { ...m };
      const original = state.stacks[m.id];
      const childId = nextId('s', state.stacks);
      const child = { ...original, id: childId, parentStackId: owner.id, bolted: false, members: [] as StackMember[] };
      state.stacks[childId] = child;
      child.members = copyMembers(original.members, child);
      return { kind: 'stack', id: childId };
    });
  }
  root.members = copyMembers(sourceMembers, root);
  if (parent) {
    parent.members.push({ kind: 'stack', id });
    parent.expanded = true;
  }
  return state;
}

export function serializeView(state: CloudFlowViewState): string {
  return JSON.stringify(state, null, 2);
}

export function restoreView(graph: GraphIndex, input: unknown): CloudFlowViewState {
  const value = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  const raw = record(value, 'session');
  if (raw.schemaVersion !== '1.0') throw new Error('session.schemaVersion: expected "1.0"');
  const crumbs = record(raw.breadcrumbs, 'session.breadcrumbs');
  const stacks = record(raw.stacks, 'session.stacks');
  for (const [id, value] of Object.entries(crumbs)) {
    const b = record(value, `breadcrumbs.${id}`);
    if (b.id !== id || !graph.nodes.has(b.currentNodeId as string))
      throw new Error(`breadcrumbs.${id}: invalid identity or missing node`);
    if (typeof b.reverse !== 'boolean' || !['start', 'search', 'traverse'].includes(b.arrival as string))
      throw new Error(`breadcrumbs.${id}: invalid arrival`);
    if (
      !Array.isArray(b.childBreadcrumbIds) ||
      new Set(b.childBreadcrumbIds).size !== b.childBreadcrumbIds.length ||
      b.childBreadcrumbIds.some((child) => !Object.hasOwn(crumbs, child))
    )
      throw new Error(`breadcrumbs.${id}: invalid child breadcrumbs`);
    if (!Array.isArray(b.childEdgeIds) || b.childEdgeIds.some((e) => !graph.edges.has(e)))
      throw new Error(`breadcrumbs.${id}: invalid child edges`);
    if (b.previousBreadcrumbId !== null && !Object.hasOwn(crumbs, String(b.previousBreadcrumbId)))
      throw new Error(`breadcrumbs.${id}: missing predecessor`);
  }
  const state = structuredClone(raw) as CloudFlowViewState;
  if (
    !state.breadcrumbs[state.breadcrumbHeadId] ||
    state.breadcrumbs[state.breadcrumbHeadId].currentNodeId !== state.focusNodeId
  )
    throw new Error('session: focus does not match breadcrumb head');
  const roots = Object.values(state.breadcrumbs).filter((b) => b.previousBreadcrumbId === null);
  if (roots.length !== 1 || roots[0].arrival !== 'start' || roots[0].incomingEdgeId !== null)
    throw new Error('session: expected one start breadcrumb');
  for (const b of Object.values(state.breadcrumbs)) {
    breadcrumbPath({ ...state, breadcrumbHeadId: b.id });
    if (b.previousBreadcrumbId) {
      const parent = state.breadcrumbs[b.previousBreadcrumbId];
      if (!parent.childBreadcrumbIds.includes(b.id))
        throw new Error(`breadcrumbs.${b.id}: predecessor does not reference child`);
      if (b.arrival === 'traverse') {
        const edge = b.incomingEdgeId ? graph.edges.get(b.incomingEdgeId) : null;
        if (
          !edge ||
          (b.reverse ? edge.target : edge.source) !== parent.currentNodeId ||
          (b.reverse ? edge.source : edge.target) !== b.currentNodeId
        )
          throw new Error(`breadcrumbs.${b.id}: arrival edge does not connect route`);
      } else if (b.arrival !== 'search' || b.incomingEdgeId !== null)
        throw new Error(`breadcrumbs.${b.id}: invalid search arrival`);
    }
    for (const childId of b.childBreadcrumbIds)
      if (state.breadcrumbs[childId].previousBreadcrumbId !== b.id)
        throw new Error(`breadcrumbs.${b.id}: inconsistent child predecessor`);
    const expected = [
      ...new Set(
        b.childBreadcrumbIds.map((id) => state.breadcrumbs[id].incomingEdgeId).filter((id): id is string => id !== null)
      ),
    ].sort();
    if (JSON.stringify([...b.childEdgeIds].sort()) !== JSON.stringify(expected))
      throw new Error(`breadcrumbs.${b.id}: child edges do not match branches`);
  }
  for (const [id, value] of Object.entries(stacks)) {
    const s = record(value, `stacks.${id}`);
    if (
      s.id !== id ||
      !graph.nodes.has(s.anchorNodeId as string) ||
      !state.breadcrumbs[s.anchorBreadcrumbId as string] ||
      state.breadcrumbs[s.anchorBreadcrumbId as string].currentNodeId !== s.anchorNodeId
    )
      throw new Error(`stacks.${id}: invalid anchor`);
    nonempty(s.label, `stacks.${id}.label`);
    if (s.anchorEdgeId !== null && !graph.edges.has(s.anchorEdgeId as string))
      throw new Error(`stacks.${id}: invalid anchor edge`);
    if (
      !['horizontal', 'vertical'].includes(s.orientation as string) ||
      !['top', 'bottom', 'left', 'right'].includes(s.side as string) ||
      typeof s.expanded !== 'boolean' ||
      typeof s.bolted !== 'boolean'
    )
      throw new Error(`stacks.${id}: invalid presentation`);
    if (!Array.isArray(s.members)) throw new Error(`stacks.${id}.members: expected an array`);
    if (s.parentStackId !== null && !Object.hasOwn(stacks, String(s.parentStackId)))
      throw new Error(`stacks.${id}: missing parent`);
    for (const value of s.members) {
      const m = record(value, `stacks.${id}.members`);
      if (m.kind === 'stack') {
        const child = record(stacks[m.id as string], `stacks.${id}: missing child stack`);
        if (child.parentStackId !== id || child.anchorBreadcrumbId !== s.anchorBreadcrumbId)
          throw new Error(`stacks.${id}: inconsistent child ownership`);
      } else if (m.kind === 'node') {
        if (!graph.nodes.has(m.id as string) || typeof m.reverse !== 'boolean')
          throw new Error(`stacks.${id}: invalid member node`);
        const edge = m.edgeId === null ? null : graph.edges.get(m.edgeId as string);
        if (
          m.edgeId !== null &&
          (!edge ||
            (m.reverse ? edge.target : edge.source) !== s.anchorNodeId ||
            (m.reverse ? edge.source : edge.target) !== m.id)
        )
          throw new Error(`stacks.${id}: invalid member edge`);
      } else throw new Error(`stacks.${id}: invalid member kind`);
    }
  }
  for (const s of Object.values(state.stacks)) {
    const seen = new Set<string>();
    let current: CloudStack | undefined = s;
    while (current) {
      if (seen.has(current.id)) throw new Error(`stacks.${s.id}: cyclic nesting`);
      seen.add(current.id);
      if (
        current.parentStackId &&
        !state.stacks[current.parentStackId].members.some((m) => m.kind === 'stack' && m.id === current!.id)
      )
        throw new Error(`stacks.${s.id}: parent does not contain child`);
      current = current.parentStackId ? state.stacks[current.parentStackId] : undefined;
    }
  }
  if (
    state.activeStackId !== null &&
    (!state.stacks[state.activeStackId] ||
      state.stacks[state.activeStackId].anchorBreadcrumbId !== state.breadcrumbHeadId)
  )
    throw new Error('session: invalid focused stack');
  return state;
}
