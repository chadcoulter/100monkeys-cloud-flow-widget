import test from 'node:test';
import assert from 'node:assert/strict';
import { indexGraph, parseDocument } from '../src/domain.js';
import {
  back,
  boltStack,
  breadcrumbPath,
  createView,
  focusBreadcrumb,
  focusStack,
  restoreView,
  searchFocus,
  serializeView,
  toggleStack,
  traverse,
} from '../src/navigation.js';
import { layoutCloud } from '../src/layout.js';
import sample from '../../../examples/cloud-flow/src/sample.json';
import validFixture from './fixtures/valid.json';
import missingFixture from './fixtures/invalid-missing-endpoint.json';
import duplicateFixture from './fixtures/invalid-duplicate-id.json';
const graph = indexGraph(sample);
const initial = () => createView(graph, 'grail');
function parser() {
  return traverse(graph, traverse(graph, initial(), 'grail-redsigma'), 'redsigma-parsing');
}

test('runtime validation indexes nodes and directed adjacency without mutating input', () => {
  assert.equal(graph.nodes.size, 30);
  assert.equal(graph.edges.size, 32);
  assert.equal(graph.outgoing.get('redsigma')!.length, 4);
  assert.equal(graph.incoming.get('language-parser')![0].source, 'parsing');
  const input = structuredClone(sample);
  const parsed = parseDocument(input);
  parsed.nodes[0].label = 'changed';
  assert.notEqual(input.nodes[0].label, 'changed');
});
test('actionable graph errors cover duplicate IDs, endpoints, metadata, and malformed documents', () => {
  assert.equal(indexGraph(validFixture).edges.size, 2);
  assert.throws(() => indexGraph(missingFixture), /missing node/);
  assert.throws(() => indexGraph(duplicateFixture), /duplicate node ID/);
  assert.throws(() => indexGraph({}), /schemaVersion/);
  assert.throws(() => indexGraph({ ...sample, nodes: [...sample.nodes, sample.nodes[0]] }), /duplicate node ID/);
  assert.throws(() => indexGraph({ ...sample, edges: [...sample.edges, sample.edges[0]] }), /duplicate edge ID/);
  assert.throws(() => indexGraph({ ...sample, edges: [{ ...sample.edges[0], target: 'missing' }] }), /missing node/);
  assert.throws(() => indexGraph({ ...sample, nodes: [{ ...sample.nodes[0], sourceRefs: [4] }] }), /sourceRefs/);
  assert.throws(() => indexGraph({ ...sample, edges: [{ ...sample.edges[0], status: 'certain' }] }), /status/);
});
test('breadcrumb arrival path and onward branches persist across backtracking', () => {
  const p = parser();
  const a = traverse(graph, p, 'parsing-language');
  const b = traverse(graph, back(a), 'resolution-parsing', true);
  assert.equal(b.focusNodeId, 'resolution');
  const returned = back(b);
  assert.equal(returned.breadcrumbs[returned.breadcrumbHeadId].childBreadcrumbIds.length, 2);
  assert.equal(traverse(graph, returned, 'parsing-language').breadcrumbHeadId, a.breadcrumbHeadId);
  assert.deepEqual(
    breadcrumbPath(a).map((b) => b.currentNodeId),
    ['grail', 'redsigma', 'parsing', 'language-parser']
  );
  assert.equal(Object.keys(p.breadcrumbs).length, 3, 'operations are immutable');
});
test('shared identities have distinct route contexts and directed traversal is explicit', () => {
  const direct = traverse(graph, parser(), 'parsing-language');
  let other = focusBreadcrumb(direct, 'b2');
  other = traverse(graph, other, 'redsigma-resolution');
  other = traverse(graph, other, 'language-resolution', true);
  assert.equal(direct.focusNodeId, other.focusNodeId);
  assert.notEqual(direct.breadcrumbHeadId, other.breadcrumbHeadId);
  assert.equal(graph.nodes.size, 30);
  assert.throws(() => traverse(graph, parser(), 'language-resolution'), /cannot be traversed/);
});
test('cycles remain traversable while rendering has finite bounds', () => {
  let s = parser();
  for (let i = 0; i < 15; i++) {
    s = traverse(graph, s, 'parsing-language');
    s = traverse(graph, s, 'language-resolution');
    s = traverse(graph, s, 'resolution-parsing');
  }
  assert.equal(s.focusNodeId, 'parsing');
  assert.equal(graph.edges.size, 32);
  assert.ok(layoutCloud(graph, s, { maxDepth: 2, maxMembers: 3 }).nodes.length < 80);
  assert.deepEqual(restoreView(graph, serializeView(s)), s);
});
test('nested horizontal and vertical stacks preserve contents, branches and focus', () => {
  let s = parser();
  const root = Object.values(s.stacks).find(
    (x) => x.anchorBreadcrumbId === s.breadcrumbHeadId && !x.parentStackId && x.side === 'top'
  )!;
  assert.equal(root.orientation, 'horizontal');
  const member = root.members[0];
  assert.equal(member.kind, 'stack');
  let nested = s.stacks[member.id];
  assert.equal(nested.orientation, 'vertical');
  const content = structuredClone(nested.members);
  s = toggleStack(toggleStack(s, nested.id), nested.id);
  assert.deepEqual(s.stacks[nested.id].members, content);
  s = boltStack(s, nested.id);
  nested = s.stacks[s.stacks[nested.id].members.at(-1)!.id];
  assert.equal(nested.orientation, 'horizontal');
  assert.equal(nested.parentStackId, member.id);
  s = focusStack(s, nested.id);
  assert.equal(s.activeStackId, nested.id);
  assert.equal(back(s).activeStackId, null);
  assert.deepEqual(restoreView(graph, s), s);
});
test('bolting creates a separate stack tree without changing domain graph or arrival route', () => {
  const s = parser();
  const before = JSON.stringify(graph.document);
  const next = boltStack(s, null);
  assert.equal(JSON.stringify(graph.document), before);
  assert.deepEqual(breadcrumbPath(next), breadcrumbPath(s));
  assert.ok(Object.keys(next.stacks).length > Object.keys(s.stacks).length);
  assert.equal(Object.values(next.stacks).filter((x) => x.bolted).length, 1);
  const serialized = serializeView(next);
  assert.deepEqual(restoreView(graph, serialized), next);
});
test('search jumps retain context without manufacturing graph relationships', () => {
  const s = searchFocus(graph, parser(), 'howie');
  const crumb = s.breadcrumbs[s.breadcrumbHeadId];
  assert.equal(crumb.arrival, 'search');
  assert.equal(crumb.incomingEdgeId, null);
  assert.equal(back(s).focusNodeId, 'parsing');
  assert.deepEqual(restoreView(graph, s), s);
});
test('restoration rejects broken routes, child branches, stack references and nesting cycles', () => {
  const valid = boltStack(parser(), null);
  const invalidNode = structuredClone(valid);
  invalidNode.focusNodeId = 'missing';
  assert.throws(() => restoreView(graph, invalidNode), /focus/);
  const cycle = structuredClone(valid);
  cycle.breadcrumbs.b1.previousBreadcrumbId = cycle.breadcrumbHeadId;
  assert.throws(() => restoreView(graph, cycle), /start breadcrumb|cycle/);
  const route = structuredClone(valid);
  route.breadcrumbs.b3.incomingEdgeId = 'grail-prism';
  assert.throws(() => restoreView(graph, route), /arrival edge|child edges/);
  const branch = structuredClone(valid);
  branch.breadcrumbs.b1.childBreadcrumbIds = ['missing'];
  assert.throws(() => restoreView(graph, branch), /invalid child/);
  const stacks = structuredClone(valid);
  const root = Object.values(stacks.stacks).find(
    (s) => s.anchorBreadcrumbId === stacks.breadcrumbHeadId && !s.parentStackId
  )!;
  root.members.push({ kind: 'stack', id: 'missing' });
  assert.throws(() => restoreView(graph, stacks), /missing child stack/);
  const nestedCycle = structuredClone(valid);
  const r = Object.values(nestedCycle.stacks).find(
    (s) => s.anchorBreadcrumbId === nestedCycle.breadcrumbHeadId && !s.parentStackId
  )!;
  r.parentStackId = r.id;
  r.members.push({ kind: 'stack', id: r.id });
  assert.throws(() => restoreView(graph, nestedCycle), /cyclic nesting/);
});
test('layout is deterministic, occurrence IDs are unique, and leaf cards do not overlap', () => {
  let s = parser();
  s = back(traverse(graph, s, 'parsing-language'));
  s = boltStack(s, null);
  for (const id of Object.keys(s.stacks)) if (!s.stacks[id].expanded) s = toggleStack(s, id);
  const layout = layoutCloud(graph, s, { maxDepth: 4 });
  assert.deepEqual(layout, layoutCloud(graph, s, { maxDepth: 4 }));
  assert.equal(new Set(layout.nodes.map((n) => n.id)).size, layout.nodes.length);
  const cards = layout.nodes.filter((n) => n.data.kind === 'card');
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i],
        b = cards[j];
      const overlap =
        a.position.x < b.position.x + b.data.width &&
        a.position.x + a.data.width > b.position.x &&
        a.position.y < b.position.y + b.data.height &&
        a.position.y + a.data.height > b.position.y;
      assert.equal(overlap, false, `${a.id} overlaps ${b.id}`);
    }
});
test('node and relationship filters affect projection without changing session identity', () => {
  const s = parser();
  const layout = layoutCloud(graph, s, { nodeType: 'component', relationshipType: 'related_to' });
  assert.ok(layout.nodes.some((n) => n.id === 'focus'));
  assert.equal(s.focusNodeId, 'parsing');
});

test('expanded lanes avoid leaf overlap with many onward branches and stack focus', () => {
  let state = initial();
  for (const edge of graph.outgoing.get('grail')!) state = back(traverse(graph, state, edge.id));
  state = boltStack(state, null);
  for (const id of Object.keys(state.stacks)) if (!state.stacks[id].expanded) state = toggleStack(state, id);
  for (const view of [
    state,
    focusStack(
      state,
      Object.values(state.stacks).find((s) => s.anchorBreadcrumbId === state.breadcrumbHeadId && s.bolted)!.id
    ),
  ]) {
    const cards = layoutCloud(graph, view, { maxDepth: 5, maxMembers: 50 }).nodes.filter((n) => n.data.kind === 'card');
    for (let i = 0; i < cards.length; i++)
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i],
          b = cards[j];
        assert.ok(
          a.position.x + a.data.width <= b.position.x ||
            b.position.x + b.data.width <= a.position.x ||
            a.position.y + a.data.height <= b.position.y ||
            b.position.y + b.data.height <= a.position.y,
          `${a.id} overlaps ${b.id}`
        );
      }
  }
});
