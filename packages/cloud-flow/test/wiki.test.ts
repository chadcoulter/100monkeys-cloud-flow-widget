import test from 'node:test';
import assert from 'node:assert/strict';
import { indexGraph, parseWikiDocument } from '../src/domain.js';
import { back, createView, openPage, restoreView, toggleStack } from '../src/navigation.js';
import { layoutCloud } from '../src/layout.js';
import sample from '../../../examples/cloud-flow/src/wiki.json';

test('wiki JSON supplies full page content, links, ordering and recursive stacks', () => {
  const document = parseWikiDocument(sample);
  const graph = indexGraph(document);
  assert.equal(document.nodes.length, 10);
  assert.match(graph.nodes.get('parsing')!.content!, /Character, symbol/);
  assert.ok(graph.outgoing.get('home')!.some((e) => e.target === 'redsigma'));
  const state = createView(graph, 'home');
  const root = Object.values(state.stacks).find((s) => s.label === 'Core architecture')!;
  assert.equal(root.orientation, 'horizontal');
  assert.equal(root.members[0].id, 'redsigma');
  const nested = state.stacks[root.members[1].id];
  assert.equal(nested.orientation, 'vertical');
  assert.deepEqual(
    nested.members.map((m) => m.id),
    ['parsing', 'math', 'resolution']
  );
  assert.equal(graph.nodes.size, 10, 'stack membership does not duplicate pages');
});
test('wiki JSON validation rejects broken content, page links, stack links and cyclic nesting', () => {
  const badContent = structuredClone(sample);
  (badContent.pages[0] as unknown as Record<string, unknown>).content = 7;
  assert.throws(() => parseWikiDocument(badContent), /content/);
  const badLink = structuredClone(sample);
  badLink.pages[0].content = '[[missing]]';
  assert.throws(() => parseWikiDocument(badLink), /missing page/);
  const badStack = structuredClone(sample);
  badStack.stacks[0].members = [{ stackId: 'missing' }];
  assert.throws(() => parseWikiDocument(badStack), /missing stack/);
  const cycle = structuredClone(sample);
  cycle.stacks[0].members.push({ stackId: cycle.stacks[0].id });
  assert.throws(() => parseWikiDocument(cycle), /cyclic nesting/);
});
test('wiki navigation restores nested expansion and onward visits', () => {
  const graph = indexGraph(sample);
  let state = createView(graph, 'home');
  const stack = Object.values(state.stacks).find((s) => s.label === 'Engine notes')!;
  state = toggleStack(state, stack.id);
  state = openPage(graph, state, 'redsigma');
  state = openPage(graph, state, 'parsing');
  const parserVisit = state.breadcrumbHeadId;
  state = back(back(state));
  assert.equal(state.stacks[stack.id].expanded, false);
  state = openPage(graph, openPage(graph, state, 'redsigma'), 'parsing');
  assert.equal(state.breadcrumbHeadId, parserVisit);
  assert.deepEqual(restoreView(graph, state), state);
});
test('unlinked stack cards open without inventing domain edges', () => {
  const graph = indexGraph(sample);
  const originalEdges = graph.edges.size;
  const state = openPage(graph, createView(graph, 'home'), 'language-parser');
  assert.equal(state.breadcrumbs[state.breadcrumbHeadId].arrival, 'open');
  assert.equal(state.breadcrumbs[state.breadcrumbHeadId].incomingEdgeId, null);
  assert.equal(graph.edges.size, originalEdges);
  assert.deepEqual(restoreView(graph, state), state);
});
test('wiki cards have readable bounds and deterministic, nonoverlapping stack lanes', () => {
  const graph = indexGraph(sample);
  const state = createView(graph, 'home');
  const layout = layoutCloud(graph, state, { wikiCards: true, maxDepth: 5 });
  assert.deepEqual(layout, layoutCloud(graph, state, { wikiCards: true, maxDepth: 5 }));
  const cards = layout.nodes.filter((n) => n.data.kind === 'card');
  assert.equal(cards.find((n) => n.data.focused)!.data.width, 470);
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
});
