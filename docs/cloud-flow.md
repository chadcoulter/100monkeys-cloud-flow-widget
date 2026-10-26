# Cloud Flow developer guide

The default application is now the JSON-driven wiki card reader. Start with [Wiki cards from JSON](./wiki-json.md) for its input format, content markup, nested stack definitions, and `WikiStacks` component. The graph APIs below remain the shared domain/navigation foundation. The capability-only reference demo is available at `/?demo=graph` for compatibility testing.

## Run the explorer

Use Node 22.12+ (validated locally on Node 24) and the root `packageManager` version, pnpm 10.33.4.

```sh
pnpm install
pnpm dev:cloud
```

Open http://127.0.0.1:3010. The start command builds the widget and its local React Flow dependencies before starting Vite. After changing widget source, rebuild with `pnpm --filter @100monkeys/cloud-flow build`; Vite watches the resulting package output. The upstream React/Svelte examples retain their existing commands.

```sh
pnpm build:cloud
pnpm check:cloud
pnpm --filter @100monkeys/cloud-flow test
pnpm exec playwright install chromium
pnpm --filter cloud-flow-demo test
pnpm format:cloud:check
```

`pnpm test:cloud` runs the widget unit tests and browser scenarios together. Browser tests start Vite themselves; build the package first in a fresh checkout. For just the Cloud Flow dependency closure, installation can use `pnpm install --filter @100monkeys/cloud-flow... --filter cloud-flow-demo...`. Installation/build of unrelated upstream examples is not required for this demo.

## Import the package

The package is independently buildable and packable, but is not yet published to npm. Its workspace dependency on React Flow becomes a version range when packed by pnpm. React and React DOM are consumer peer dependencies.

```tsx
import { CloudFlow, type CloudFlowDocument } from '@100monkeys/cloud-flow';
import '@xyflow/react/dist/style.css';
import '@100monkeys/cloud-flow/style.css';

export function Explorer({ document }: { document: CloudFlowDocument }) {
  return (
    <div style={{ height: '100vh' }}>
      <CloudFlow
        document={document}
        initialFocusNodeId="grail"
        onFocusChange={(nodeId, breadcrumb) => console.log(nodeId, breadcrumb.id)}
        onViewStateChange={state => console.log(state)}
      />
    </div>
  );
}
```

For controlled use, supply `viewState` and update it through `onViewStateChange`. For uncontrolled use, omit `viewState`; optionally pass `initialViewState` or `initialFocusNodeId`. `initialViewState` takes precedence over the initial focus. Callback state is the complete next session. Changing the document resets an uncontrolled exploration; a controlled session must reference nodes and edges in the new document. A missing initial node or invalid controlled/initial session throws an actionable error, allowing the host's error boundary to handle it.

`reducedMotion` overrides the initial OS preference. The built-in checkbox lets the user change motion during a session. The component also follows changes to the OS preference when no explicit prop is supplied. `className` and `children` support host integration (children appear in the inspector). The UI uses browser APIs and is intended for client rendering.

## Domain document

`parseDocument(unknown)` validates and returns a defensive copy. `indexGraph(unknown)` adds maps for nodes, edges, and both traversal directions. Domain graph cycles and self-edges are legal. Node and edge IDs are unique within their respective collections.

```json
{
  "schemaVersion": "1.0",
  "nodes": [
    { "id": "a", "type": "capability", "label": "A" },
    { "id": "b", "type": "component", "label": "B", "sourceRefs": ["Source record"] }
  ],
  "edges": [
    { "id": "a-b", "source": "a", "target": "b", "type": "uses", "status": "proposed" }
  ]
}
```

Node types: architecture, capability, component, function, application, research, evidence, governance. Optional fields: description, maturity, sourceRefs, metadata. Edges accept any nonempty relationship type, with contribution, status, and sourceRefs optional. Status is documented, proposed, or validated. Known types have explicit inverse labels; custom types display a reverse label. Validation errors identify duplicate IDs, missing endpoints, incorrect field types, and unsupported schema versions. Runtime validators are the executable schema; see `test/fixtures` for standalone valid/invalid examples.

The sample contains 30 records and 32 directed edges. October core architecture relationships are documented. Demonstration mappings between August portfolio records and October components are marked proposed. Similar names are retained as separate source identities. Maturity is not inferred from names. Source descriptions are inventory statements, not independent verification of the technology.

## Navigation and recursive breadcrumb stacks

The domain graph holds shared identities. Each breadcrumb is a visit context, referencing its predecessor, current domain node, arrival edge, and explored children. `childBreadcrumbIds` extends the brief's tuple so onward branches retain their own contexts and stack state. `childEdgeIds` records the unique real arrival edges of those children.

`traverse(graph, state, edgeId, reverse)` creates an onward visit. Reverse traversal must be explicit. Reopening the same child through the same edge from the same breadcrumb returns to the existing visit, including nested stack expansion. Reaching the same node from a different predecessor creates another breadcrumb referencing the same domain identity.

`back(state)` returns along the predecessor chain without discarding children. `focusBreadcrumb(state, id)` restores any saved context. Arrival history is rendered to the left, already explored onward branches to the right, and relationship stacks above/below the focus. No navigation operation changes the graph.

`searchFocus(graph, state, nodeId)` preserves the preceding context with an explicit search-jump breadcrumb. Its arrival edge is null; search never fabricates a graph edge. The inspector and route distinguish search jumps from relationship traversal.

## Stacks, focus, and bolting

A stack is an ordered horizontal or vertical projection associated with one breadcrumb. Members reference nodes or nested stacks. The automatic relationship projection has horizontal top/bottom roots and vertical groups by relationship type. Stack orientation and four attachment lanes are explicit. Expanded state has one authoritative field, `stack.expanded`; a redundant `expandedStackIds` list is deliberately omitted.

`toggleStack` preserves members. `focusStack` makes any stack central while retaining its owning breadcrumb and domain context. `activeStackId` identifies stack focus; null means the breadcrumb's node is central. Back exits stack focus before following the predecessor.

`boltStack(state, parentStackId)` attaches a new exploration stack. Pass null to attach to the focus card, or a stack ID to nest it within that stack. The new stack copies the current relationship projection's references into an independent stack tree. It is a saved exploration projection, not a domain relationship or a duplicate capability. A nested bolt alternates its parent's orientation. Existing route and branches stay intact.

In the demo, use **Bolt exploration** for the active focus or ↗ on a stack to bolt within it. Each visit has its own relationship/bolted stacks; returning to that visit restores them.

## Layout and rendering limits

`layoutCloud(graph, state, options)` is a pure deterministic function returning React Flow nodes and edges. Cards have fixed dimensions; stack bounds are calculated recursively. Four separate lanes reserve space for nested content. Canvas IDs identify visual occurrences, while card data references domain IDs. Stacks intentionally contain child bounds; separate leaf cards must not overlap.

Rendering defaults to depth 3, 8 members per stack and a global expansion budget of 400; depth is capped at 8 and members at 50. These limits only affect projection. All session records persist. Increase the depth/member controls or select another breadcrumb to inspect omitted history. The sidebar exposes stack controls even when cards are outside the viewport. Search provides direct access to any node. Pan, zoom, Fit all, and Fit to focus expose off-screen content.

Stable IDs and deterministic coordinates support transitions. Focus changes recenter the viewport; expansion preserves the current viewport. Reduced motion disables the animated recenter. This milestone recalculates lane positions when content dimensions change; it does not promise unchanged coordinates for every neighboring card.

## Persistence and accessibility

`serializeView` produces JSON; `restoreView(graph, unknown)` validates version, focus, graph references, reciprocal predecessor/child links, arrival edges/directions, stack ownership, and acyclic navigation/stack structures. Domain cycles remain legal. Restore rejects references absent from a revised graph rather than silently dropping them. Automatic migration between graph/schema versions is not implemented.

Save session stores the exploration in this browser; Restore saved works after reload. Download session exports JSON; Session JSON accepts a pasted export. Filters, viewport, and OS motion preference are user display settings rather than saved graph/navigation state.

All operations have native buttons/inputs and visible keyboard focus. Tab and Enter operate cards, stack expansion, focus, bolting, search, and restoration. Alt + Left goes back; Escape exits stack focus. The inspector exposes route and provenance as text. The interface rearranges into vertical panels on narrow screens. Rendering bounds are tested, but the full 400-node maximum has not been benchmarked and a formal assistive-technology audit remains future work.
