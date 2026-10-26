# 100 Monkeys Cloud Flow Widget

**Implementation README / Codex build brief**

**Version:** 0.3 — October 26, 2026

**Foundation:** [xyflow/xyflow](https://github.com/xyflow/xyflow) (React Flow)
**Domain model:** 100 Monkeys Unified Capability Architecture, gr{Ai}Γ / REDΣ

## Run this project

The original upstream README is preserved as [`readme_orig`](./readme_orig). This document is the supplied 100 Monkeys build brief. The implementation and API guide is [`docs/cloud-flow.md`](./docs/cloud-flow.md); upstream provenance is in [`UPSTREAM.md`](./UPSTREAM.md).

```sh
pnpm install
pnpm dev:cloud
```

Open http://127.0.0.1:3010. Use Node 22.12+ and pnpm 10.33.4. Run `pnpm build:cloud`, `pnpm check:cloud`, and `pnpm test:cloud` for validation (install Chromium with `pnpm exec playwright install chromium` before browser tests).

The default demo builds **wiki information cards and nested stacks directly from JSON**. Pages supply titles and full text; stack definitions supply ordering, horizontal/vertical grouping, and nesting. Use **Load wiki JSON** or **Edit JSON → Build stacks** to supply your content. See [`docs/wiki-json.md`](./docs/wiki-json.md) for the simple format and [`examples/cloud-flow/src/wiki.json`](./examples/cloud-flow/src/wiki.json) for a complete sample.

The breadcrumb stack preserves both how you arrived and where you have already explored from each visit. Returning restores its onward branches and nested stacks. Separate visits may reference one shared domain node. See the developer guide for the implemented extensions to the suggested types below.

## Mission and implementation brief

Build **100 Monkeys Cloud Flow Widget** as a fork-based extension of React Flow: a JSON-driven, focus-centered, recursive content-cloud navigator for connected capabilities, components, functions, applications, research, and evidence.

The widget must make a many-to-many relationship lattice explorable through **horizontal and vertical nested stacks of cards**. Any card or stack can become the current focus. The user can expand stacks, follow typed relationships, bolt a new stack onto an existing stack, branch exploration, and return through recursive breadcrumbs without losing context.

**Important:** The graph is the persistent domain model; the stack arrangement is a navigational projection; the current focus is the active point of resolution. Do not flatten the domain into a tree or confuse visual parentage with domain ownership.

## Codex: execution instructions

You are the implementation agent for the **100 Monkeys Cloud Flow Widget**. Work in the repository available to you. Inspect its actual contents before modifying anything. Implement working code, tests, sample data, and developer documentation; do not stop at an architectural proposal.

1. **Inspect the upstream project.** Confirm the remote, current branch, package manager, monorepo structure, React Flow package/API version, license and existing test/build scripts. Record the upstream commit SHA. The intended upstream is `https://github.com/xyflow/xyflow`.
2. **Fork or use an existing fork.** If GitHub authentication and permission allow, create or work within a fork under the 100 Monkeys organization/account, using the repository name `100monkeys-cloud-flow-widget` where available. If permissions or the target owner are unavailable, work in a local feature branch and document the exact manual fork/push steps; do not claim a remote fork was created.
3. **Keep upstream provenance.** Preserve the MIT license and required notices. Add a clear `UPSTREAM.md` with the source URL, base commit, fork changes, and update strategy. Avoid wholesale rewrites of React Flow internals when extension points suffice.
4. **Create the widget as an independently importable React/TypeScript package** inside the existing workspace when feasible. Use React Flow as the canvas, nodes, edges, viewport, and interaction foundation. Implement domain, navigation, and layout logic as separately testable modules.
5. **Build an executable demo** that loads the included 100 Monkeys sample JSON and demonstrates the complete focus → traverse → expand → bolt → branch → back workflow.
6. **Run the repository's available formatting, type-checking, linting, build, and test commands.** Report actual results and remaining limitations. Do not fabricate completed work.

## Product behavior

### 1. JSON content cloud

Load a JSON document containing uniquely identified nodes, typed edges, and optional presentation metadata. The same node may be connected to multiple capabilities. The cloud must render relationships around the focused node and permit switching focus by selecting a visible node/card.

The JSON document is authoritative for the graph. Layout coordinates, stack expansion, breadcrumbs, and selection are view state and must not mutate domain identity.

### 2. Focus-centered navigation

- A single **current focus** card or stack occupies the central focal position.
- Selecting a related card makes it the new focus and reflows surrounding stacks.
- Related stacks can appear above, below, left, and right; each axis supports recursive nesting.
- The active focus may be reached by multiple routes, each with distinct breadcrumb context.
- Preserve stable IDs and accessible labels across focus changes.

### 3. Recursive stacks of stacks

- Stacks contain ordered cards and/or other stacks.
- A stack has an orientation (`horizontal` or `vertical`) and an attachment context.
- Expand and collapse any stack without destroying its content or the navigation path.
- Support top/bottom and left/right stack groups relative to the current focus.
- Support an **end-stack** presentation: prior focus cards shift into surrounding stacks as the selected card becomes active.
- A stack can be **bolted** to the active card/stack to create an exploration branch. Bolting is a view/navigation operation by default; it must not silently add a domain edge.

### 4. Recursive breadcrumb tuples

Represent a navigation step as:

`B_n = (previous_breadcrumb_id, current_node_id, incoming_edge_id, child_edge_ids)`

Every step references its predecessor. The breadcrumb chain reconstructs the route used to reach the focus. Re-visiting the same node through a different edge creates a distinct breadcrumb, **not** a duplicate domain node. Support back, branch, and restoration of saved navigation sessions.

### 5. Traversal and relationships

Initial relationship types: `contains`, `contributes_to`, `depends_on`, `implements`, `uses`, `transforms`, `resolves`, `governs`, `derived_from`, `related_to`, `validated_by`.

Relationship traversal must be directed where appropriate, with explicit inverse labels or reverse-traversal options. Cycles are legal in the domain graph. Prevent infinite recursive expansion through bounded rendering, visited-path tracking, and user-controlled depth limits; do **not** delete cyclic edges.

### 6. Search, filters, and accessibility

Provide node search, type filters, relationship filters, keyboard focus/navigation, visible selection state, meaningful accessible names, and a reduced-motion option. Support pan, zoom, fit-to-focus, and a clear reset action. Ensure usability with touch and mouse input.

## Architecture

| Module | Responsibility |
|---|---|
| `domain` | JSON schema, stable node/edge identities, graph indexing, validation, provenance |
| `navigation` | Recursive breadcrumbs, traversal, branching, back/restore |
| `stacks` | Stack records, nesting, bolting, expand/collapse |
| `layout` | Deterministic focus-centered horizontal/vertical stack placement |
| `react` | React hooks, state orchestration, React Flow adapters |
| `ui` | Custom cards, stacks, controls, relationship cloud, detail inspector |
| `demo` | Runnable 100 Monkeys capability explorer |

Use the upstream workspace conventions for package names and locations. Suggested exported API:

```ts
export type CloudFlowDocument = {
  schemaVersion: '1.0';
  nodes: CloudNode[];
  edges: CloudEdge[];
};

export type CloudNode = {
  id: string;
  type: 'architecture' | 'capability' | 'component' | 'function' |
    'application' | 'research' | 'evidence' | 'governance';
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

export type Breadcrumb = {
  id: string;
  previousBreadcrumbId: string | null;
  currentNodeId: string;
  incomingEdgeId: string | null;
  childEdgeIds: string[];
};

export type CloudStack = {
  id: string;
  parentStackId: string | null;
  anchorNodeId: string;
  anchorEdgeId: string | null;
  orientation: 'horizontal' | 'vertical';
  members: Array<{ kind: 'node' | 'stack'; id: string }>;
  expanded: boolean;
};

export type CloudFlowViewState = {
  focusNodeId: string;
  breadcrumbHeadId: string | null;
  activeStackId: string | null;
  stacks: Record<string, CloudStack>;
  breadcrumbs: Record<string, Breadcrumb>;
  expandedStackIds: string[];
};
```

Expose a component with a controlled/uncontrolled state option:

```tsx
<CloudFlow
  document={capabilityDocument}
  initialFocusNodeId="grail"
  onFocusChange={(nodeId, breadcrumb) => { /* consumer callback */ }}
  onViewStateChange={(state) => { /* optional persistence */ }}
/>
```

Names may be adapted to upstream conventions, but preserve the functional contract. Use runtime JSON validation with actionable errors for duplicate IDs, missing endpoints, invalid stack references, and malformed documents.

## Reference data: 100 Monkeys

Seed the demo with the following **architecture and capability nodes**. Keep names, relationships, and implementation claims traceable to the supplied capability source documents. When exact contribution mappings are not established, mark edges `proposed` instead of asserting implementation.

### Architectural core

- **gr{Ai}Γ Coherence Architecture and Engine** — overarching coherence architecture.
- **REDΣ** — Distributed Agentic Structured Resolution Architecture.
- **REDΣ Parsing Engine** — structured interpretation, identity, boundaries, relationships.
- **REDΣ Transformation Math Library** — set calculus, constraints, state transformations, composition, reverse validation.
- **REDΣ Distributed Agent-Facilitated Architecture** — agent/resolver/tool coordination and structured execution.
- **REDΣ Coherence and Resolution Engine** — coherence evaluation, state and relationship reconciliation.

### Existing portfolio and related systems

- Language Parser
- Transformation Math
- Causal Reality Analyzer
- gr{Ai}Γ Resolver System
- Conflict and Paradox Resolution Engine
- Cartography Engine
- Prism Portal
- Resolution Workspace
- Steward Advanced Wiki Curator
- Core Identity Resolver and PII Protection System
- ARTUR Challenge Layer
- REDΣ Transformation Library
- Next-Gen Distributed Encryption Process
- REDΣ Token Governance Stack
- Homeschool Tutor App
- Core Research Group — General Architecture Research
- Legal Research and Case Development System
- HOWIE Transformation Engine

### Additional research areas

- Dynamic Event Engine research
- Adaptive Computing and Operating Systems research
- Veda OS and heterogeneous computing
- Historical knowledge recovery
- Structured machine intelligence
- Advanced integration and cross-system context portability

Keep potentially overlapping descriptions (for example, `Language Parser` versus `REDΣ Parsing Engine`) as separate source records until their exact relationship is verified. The demo should explicitly show how a shared component can appear in multiple capability views without duplicating its identity.

## Required demo scenarios

1. **Initial focus:** gr{Ai}Γ appears in the center, with REDΣ and related capabilities discoverable.
2. **Traverse:** select REDΣ → Parsing Engine; the active focus moves and the preceding path is retained.
3. **Cross-link:** navigate to a component referenced by more than one capability; verify shared identity and route-specific breadcrumbs.
4. **Expand:** open a vertical stack, then a horizontal nested stack, then collapse and reopen both without losing contents.
5. **Bolt:** attach a new exploration stack to the current focus; preserve the original route and show the branch.
6. **Back and recenter:** return along breadcrumbs, then focus a different card and verify layout recomputation.
7. **Cycle:** load graph data containing a cycle; navigate safely without infinite expansion.
8. **Restore:** serialize view state, reload the demo, and restore focus, breadcrumbs, branches, and expanded stacks.
9. **Filter/search:** find a named capability and move it into focus while preserving a valid navigation context.
10. **Keyboard:** complete focus selection, expand/collapse, and back operations without a mouse.

## Layout rules

Implement a deterministic layout function that receives the graph, view state, and viewport constraints and returns React Flow nodes/edges. Keep it independently unit-testable. Place the active focus centrally, reserve separate lanes for top, bottom, left, and right stack groups, and allow nested stacks to claim additional space. Avoid overlap; introduce scrolling/panning rather than clipping content. Prefer stable positions between adjacent navigation steps and animate transitions only when reduced-motion settings permit.

Do not depend on force-directed randomness for the core layout. If a cloud mode is added, it is an alternate projection of the same graph and navigation state, not a second data model.

## Repository deliverables

- Working widget package with public exports and TypeScript types.
- Runnable demo application with sample JSON and a visible node/edge detail panel.
- JSON schema (or equivalent runtime schema) plus valid/invalid fixtures.
- Unit tests for graph indexing, breadcrumbs, cycles, stack nesting, bolting, and deterministic layout.
- Interaction tests for the required demo scenarios, using the repository's existing test stack or an appropriate minimal addition.
- Documentation covering installation, API, JSON format, navigation semantics, build/test commands, and architecture.
- `UPSTREAM.md` documenting the fork origin, upstream commit, license notices, and update approach.
- A final implementation report listing files changed, commands executed, results, and unresolved work.

## Acceptance criteria

The initial milestone is accepted when a developer can install dependencies, run the demo, load the JSON capability inventory, navigate through multiple shared relationships, expand nested horizontal and vertical stacks, bolt a new branch, backtrack through recursive breadcrumbs, restore a saved view, and run passing tests. The graph must preserve node identity and provenance throughout these operations.

## Scope boundaries

Implement the interactive widget and its supporting graph/navigation model first. Do not implement the REDΣ engines themselves, infer maturity from naming, create undocumented technical dependencies, or claim remote GitHub operations succeeded unless confirmed. The sample inventory demonstrates navigation; deeper component contribution mapping will be populated from verified capability records.

## Sources and upstream

- React Flow upstream: https://github.com/xyflow/xyflow
- React Flow documentation: https://reactflow.dev/
- 100 Monkeys source: `GRAIL_RED_Sigma_Capabilities.docx` (October 2026)
- 100 Monkeys source: `100_Monkeys_Current_Capabilities.docx` (August 2026)
- Prior architecture: `Capability_Lattice_Business_Technical_Spec.docx` (v0.1)
- Prior unified specification: *Unified Capability Architecture & Recursive Lattice Navigator* (v0.2)

---

**Definition of success:** A reusable 100 Monkeys Cloud Flow Widget that turns JSON relationship data into a focus-centered, recursive, stack-of-stacks navigation experience while preserving shared identities, typed relationships, and every route of exploration.
